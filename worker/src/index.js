import { adminPage } from './admin.js';
/* Seed Watch API: address-only blockchain explorer, no mnemonic/private-key inputs.
 * Keep logs disabled; no persistent wallet identifier storage in D1.
 */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, private',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'"
};
function response(data, status, request, env) {
 const headers = new Headers(JSON_HEADERS);
 const origin = request.headers.get('Origin');
 if (origin && origin === (env.ALLOWED_ORIGIN || 'https://xulytiengviet.github.io')) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'content-type');
  headers.set('Access-Control-Max-Age', '600');
  headers.set('Vary', 'Origin');
 }
 return new Response(JSON.stringify(data), {status, headers});
}
function bad(message, code, req, env) { return response({error:message}, code, req, env); }
function validAddress(chain, address) {
 if (typeof address !== 'string' || address.length > 100) return false;
 if (chain === 'ETH') return /^0x[a-fA-F0-9]{40}$/.test(address);
 if (chain === 'BTC') {
  if (/^bc1[ac-hj-np-z02-9]{11,87}$/i.test(address))
   return address === address.toLowerCase() || address === address.toUpperCase();
  return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
 }
 return false;
}
function units(value, decimals) {
 const n = BigInt(value);
 const unit = 10n ** BigInt(decimals);
 const whole = n / unit;
 const fraction = (n % unit).toString().padStart(decimals, '0').replace(/0+$/, '');
 return fraction ? whole.toString()+'.'+fraction : whole.toString();
}
async function providerJson(url) {
 let res;
 try { res = await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(9000)}); }
 catch { throw new Error('Nhà cung cấp blockchain không phản hồi.'); }
 if (!res.ok) throw new Error('Nhà cung cấp blockchain trả về lỗi HTTP '+res.status+'.');
 try { return await res.json(); }
 catch { throw new Error('Dữ liệu blockchain không hợp lệ.'); }
}
async function balance(chain,address) {
 if (chain==='BTC') {
  const json=await providerJson('https://mempool.space/api/address/'+encodeURIComponent(address));
  const a=json.chain_stats, b=json.mempool_stats;
  const numberKeys=['funded_txo_sum','spent_txo_sum'];
  if (!a || !b || !numberKeys.every(k=>Number.isSafeInteger(a[k]) && Number.isSafeInteger(b[k]) && a[k]>=0 && b[k]>=0))
   throw new Error('Định dạng dữ liệu BTC không hợp lệ.');
  const sats=BigInt(a.funded_txo_sum)-BigInt(a.spent_txo_sum)+BigInt(b.funded_txo_sum)-BigInt(b.spent_txo_sum);
  if(sats<0n) throw new Error('Số dư BTC bất thường.');
  return {balance:units(sats,8),unit:'BTC',provider:'mempool.space',confirmed_only:false};
 }
 const json=await providerJson('https://eth.blockscout.com/api/v2/addresses/'+encodeURIComponent(address));
 if(typeof json.coin_balance!=='string' || !/^\d+$/.test(json.coin_balance))
  throw new Error('Định dạng dữ liệu ETH không hợp lệ.');
 return {balance:units(json.coin_balance,18),unit:'ETH',provider:'Blockscout',confirmed_only:false};
}
async function recordAggregate(env,chain,ok) {
 if(!env.DB) return;
 try {
  await env.DB.prepare('INSERT INTO scan_daily(day,chain,total_scans,successful_scans) VALUES(?,?,1,?) ON CONFLICT(day,chain) DO UPDATE SET total_scans=total_scans+1, successful_scans=successful_scans+excluded.successful_scans')
    .bind(new Date().toISOString().slice(0,10),chain,ok?1:0).run();
 } catch {
  // Failure of optional anonymous analytics never affects balance lookup.
 }
}
function decodeB64Url(str) {
 if (typeof str !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(str)) throw new Error('invalid token');
 const padded = str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4);
 const raw=atob(padded);
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function adminAuthorized(request,env) {
 const team=String(env.CF_ACCESS_TEAM_DOMAIN||'').replace(/^https?:\/\//,'').replace(/\/$/,'').toLowerCase();
 const aud=String(env.CF_ACCESS_AUD||'').trim();
 const admins=String(env.ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
 if(!team || !/^[-a-z0-9.]+\.cloudflareaccess\.com$/.test(team) || !aud || !admins.length) return false;
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token || token.length>9000) return false;
 const parts=token.split('.');
 if(parts.length!==3) return false;
 try {
  const header=JSON.parse(new TextDecoder().decode(decodeB64Url(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(decodeB64Url(parts[1])));
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>128) return false;
  const now=Math.floor(Date.now()/1000);
  if(payload.iss!=='https://'+team || !Array.isArray(payload.aud) || !payload.aud.includes(aud)) return false;
  if(!Number.isFinite(payload.exp)||payload.exp<=now || !Number.isFinite(payload.iat)||payload.iat>now+60) return false;
  if(payload.nbf!==undefined && (!Number.isFinite(payload.nbf)||payload.nbf>now))return false;
  if(!admins.includes(String(payload.email||'').toLowerCase())) return false;
  const keysResponse=await fetch('https://'+team+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(5000)});
  if(!keysResponse.ok)return false;
  const keys=await keysResponse.json();
  const jwk=keys.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');
  if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodeB64Url(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
 } catch {return false;}
}
export default {
 async fetch(request, env) {
  const url=new URL(request.url);
  if(request.method==='OPTIONS') {
   const allowed = request.headers.get('Origin')===(env.ALLOWED_ORIGIN||'https://xulytiengviet.github.io');
   return allowed ? new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':request.headers.get('Origin'),'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'content-type','Access-Control-Max-Age':'600','Vary':'Origin'}}) : bad('Nguồn truy cập không được phép.',403,request,env);
  }
  if(request.method!=='GET') return bad('Chỉ hỗ trợ GET.',405,request,env);
  if(url.pathname==='/v1/health') return response({
   service:'seed-watch-api',status:'ok',mode:'watch-only',database_connected:Boolean(env.DB),
   safe_input:'public-address-only'
  },200,request,env);
  if(url.pathname==='/v1/pricing') return response({
   currency:'VND',price_per_lookup:0,billing_enabled:false,
   disclaimer:'Miễn phí thử nghiệm; chưa có hệ thống thu phí hoặc tín dụng hoạt động.'
  },200,request,env);
  if(url.pathname==='/v1/balance') {
   const chain=(url.searchParams.get('chain')||'').toUpperCase();
   const address=url.searchParams.get('address')||'';
   if(!validAddress(chain,address))return bad('Chỉ chấp nhận địa chỉ công khai BTC/ETH hợp lệ.',400,request,env);
   try{
    const output=await balance(chain,address);
    await recordAggregate(env,chain,true);
    return response({chain,address,...output,checked_at:new Date().toISOString()},200,request,env);
   }catch {
    await recordAggregate(env,chain,false);
    return bad('Không thể xác minh số dư từ nhà cung cấp blockchain. Vui lòng thử lại.',502,request,env);
   }
  }
  if(url.pathname==='/admin'){
   if(!await adminAuthorized(request,env))return bad('Không được phép truy cập quản trị.',403,request,env);
   return new Response(adminPage(),{status:200,headers:{
    'content-type':'text/html; charset=utf-8','cache-control':'no-store, private',
    'content-security-policy':"default-src 'self'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'",
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
  }
  if(url.pathname==='/v1/admin/stats'){
   if(!await adminAuthorized(request,env))return bad('Không được phép truy cập quản trị.',403,request,env);
   if(!env.DB)return response({database_connected:false,stats:[]},200,request,env);
   try{
    const data=await env.DB.prepare('SELECT day,chain,total_scans,successful_scans FROM scan_daily ORDER BY day DESC LIMIT 30').all();
    return response({database_connected:true,stats:data.results||[]},200,request,env);
   }catch{return bad('Không thể tải thống kê.',503,request,env);}
  }
  return bad('Không tìm thấy API.',404,request,env);
 }
};
