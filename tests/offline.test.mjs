import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const html=readFileSync(new URL('../offline/validator.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
test('validator is single-file and denies network with CSP',()=>{
 assert.ok(script);assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(script,/fetch\s*\(/);assert.doesNotMatch(script,/XMLHttpRequest/);
});
test('BIP39 English 12-word valid and invalid checksum vectors',async()=>{
 const handlers={};
 const area={value:'',blur(){}},strong={textContent:''},para={textContent:''};
 const fakeButton=id=>({addEventListener:(event,fn)=>{handlers[id+':'+event]=fn;}});
 const document={
  getElementById(id){if(id==='phrase')return area; return fakeButton(id);},
  querySelector(sel){return sel.endsWith('strong')?strong:para;}
 };
 vm.runInNewContext(script,{document,crypto:webcrypto,Uint8Array,Map});
 area.value=Array(11).fill('abandon').concat('about').join(' ');
 await handlers['validate:click']();
 assert.match(strong.textContent,/checksum hợp lệ/);assert.equal(area.value,'');
 area.value=Array(12).fill('abandon').join(' ');
 await handlers['validate:click']();
 assert.match(strong.textContent,/Checksum không khớp/);assert.equal(area.value,'');
});
