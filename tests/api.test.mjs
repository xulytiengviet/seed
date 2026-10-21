import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';

function req(path, options) {return new Request('https://seed-watch-api.example.com'+path,options);}
async function json(res){return await res.json();}

test('health does not expose secrets and declares watch-only',async()=>{
 const res=await worker.fetch(req('/v1/health'),{});
 const b=await json(res);
 assert.equal(res.status,200); assert.equal(b.mode,'watch-only');assert.equal(b.safe_input,'public-address-only');
 assert.equal(b.database_connected,false);
});
test('pricing is explicitly free without billing',async()=>{
 const b=await json(await worker.fetch(req('/v1/pricing'),{}));
 assert.equal(b.price_per_lookup,0);assert.equal(b.billing_enabled,false);
});
test('seed phrase is rejected as an address',async()=>{
 const res=await worker.fetch(req('/v1/balance?chain=BTC&address='+encodeURIComponent('abandon '.repeat(11)+'about')),{});
 assert.equal(res.status,400);
});
test('CORS only allows Pages origin and OPTIONS has no body',async()=>{
 const allowed=await worker.fetch(req('/v1/health',{headers:{Origin:'https://xulytiengviet.github.io'}}),{});
 assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),'https://xulytiengviet.github.io');
 const denied=await worker.fetch(req('/v1/health',{headers:{Origin:'https://evil.example'}}),{});
 assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
 const opts=await worker.fetch(req('/v1/balance',{method:'OPTIONS',headers:{Origin:'https://xulytiengviet.github.io'}}),{});
 assert.equal(opts.status,204);assert.equal(await opts.text(),'');
});
test('admin routes cannot be reached without a verified Access token',async()=>{
 assert.equal((await worker.fetch(req('/admin'),{})).status,403);
 assert.equal((await worker.fetch(req('/v1/admin/stats'),{})).status,403);
});
test('ETH lookup uses only public address and reports exact wei as ether',async()=>{
 const old=globalThis.fetch;let upstream='';
 globalThis.fetch=async(url)=>{upstream=String(url);return new Response(JSON.stringify({coin_balance:'1234567890000000000'}),{status:200,headers:{'content-type':'application/json'}});};
 try{
  const address='0x0000000000000000000000000000000000000000';
  const res=await worker.fetch(req('/v1/balance?chain=ETH&address='+address),{});
  const b=await json(res);
  assert.equal(res.status,200);assert.equal(b.balance,'1.23456789');
  assert.match(upstream,/eth\.blockscout\.com/);assert.ok(!JSON.stringify(b).includes('privateKey'));
 } finally {globalThis.fetch=old;}
});
test('BTC lookup sums on-chain and mempool balance in satoshis',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({chain_stats:{funded_txo_sum:125000,spent_txo_sum:25000},mempool_stats:{funded_txo_sum:10000,spent_txo_sum:0}}));
 try{
  const address='1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
  const b=await json(await worker.fetch(req('/v1/balance?chain=BTC&address='+address),{}));
  assert.equal(b.balance,'0.0011');assert.equal(b.unit,'BTC');
 } finally {globalThis.fetch=old;}
});
