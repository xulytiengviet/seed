(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const addressInput = $('address'), result = $('result'), endpointInput = $('api-url');
const button = $('scan-button'), status = $('status-label'), statusDot = $('status-dot');
let apiBase = String(window.SEED_WATCH_API || '').trim().replace(/\/$/, '');
let lastRequestId = 0;
function validApi(value) {
 try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash; }
 catch { return false; }
}
function view(kind, title, desc) {
 result.className = 'result ' + kind;
 result.replaceChildren();
 const icon = document.createElement('div'); icon.className='result-icon';
 icon.textContent = kind === 'success' ? '✓' : kind === 'error' ? '!' : '◎';
 const body = document.createElement('div'), h3 = document.createElement('h3'), p = document.createElement('p');
 h3.textContent=title; p.textContent=desc; body.append(h3,p); result.append(icon,body);
}
function setConnected(ok, label) {
 status.textContent=label; statusDot.classList.toggle('online',ok);
 $('api-state').textContent=ok?'ĐÃ KẾT NỐI':'CHƯA KẾT NỐI';
 $('api-caption').textContent=ok?'Cloudflare Worker đang phản hồi':'Kiểm tra URL Worker và cấu hình CORS';
}
function selectedChain() { return document.querySelector('input[name="chain"]:checked').value; }
function validAddress(chain,value) {
 if (chain==='ETH') return /^0x[a-fA-F0-9]{40}$/.test(value);
 return /^(bc1[ac-hj-np-z02-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(value);
}
async function api(path) {
 if (!apiBase || !validApi(apiBase)) throw new Error('Chưa cấu hình Cloudflare Worker URL (HTTPS).');
 const controller = new AbortController(); const timeout=setTimeout(()=>controller.abort(),10000);
 try {
  const response=await fetch(apiBase+path,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,referrerPolicy:'no-referrer'});
  const data=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(typeof data.error==='string'?data.error:'API trả về lỗi HTTP '+response.status);
  return data;
 } finally {clearTimeout(timeout);}
}
async function checkHealth() {
 if (!apiBase || !validApi(apiBase)) {setConnected(false,'Chưa cấu hình API');return;}
 try {
  const health=await api('/v1/health');
  if (health.service!=='seed-watch-api') throw new Error('Worker không đúng ứng dụng');
  setConnected(true,'API đang hoạt động');
  const fees=await api('/v1/pricing');
  $('price-value').textContent=fees.price_per_lookup===0?'0 ₫':'Xem API';
  $('price-caption').textContent=fees.price_per_lookup===0?'Miễn phí trong bản thử nghiệm':'Kiểm tra thông tin phí trong API';
 } catch(e) {setConnected(false,'API không phản hồi');}
}
$('connect-button').addEventListener('click',()=>{
 const next=endpointInput.value.trim().replace(/\/$/,'');
 if (!validApi(next)) {view('error','URL không hợp lệ','Cần URL HTTPS của Cloudflare Worker, không kèm tài khoản/mật khẩu.');return;}
 apiBase=next; checkHealth();
});
$('scan-form').addEventListener('submit',async (event)=>{
 event.preventDefault();
 const chain=selectedChain(), address=addressInput.value.trim();
 if (/\s/.test(address) || !validAddress(chain,address)) {
  view('error','Địa chỉ ví không hợp lệ','Chỉ nhập địa chỉ công khai BTC hoặc ETH; tuyệt đối không nhập seed/private key.');
  return;
 }
 const reqId=++lastRequestId;
 button.disabled=true; view('','Đang kiểm tra dữ liệu...','Đọc số dư từ nhà cung cấp blockchain qua Cloudflare Worker.');
 try {
  const data=await api('/v1/balance?chain='+encodeURIComponent(chain)+'&address='+encodeURIComponent(address));
  if (reqId!==lastRequestId) return;
  if(data.chain!==chain || typeof data.balance!=='string') throw new Error('Kết quả API không hợp lệ');
  view('success',data.balance+' '+chain,'Địa chỉ: '+data.address+' · Nguồn: '+data.provider+' · Cập nhật: '+new Date(data.checked_at).toLocaleString('vi-VN'));
 } catch(error){
  if(reqId!==lastRequestId)return;
  const message=error.name==='AbortError'?'Hết thời gian chờ dữ liệu.':error.message;
  view('error','Chưa truy vấn được số dư',message+' Không đồng nghĩa địa chỉ có số dư bằng 0.');
 } finally {if(reqId===lastRequestId)button.disabled=false;}
});
document.querySelectorAll('input[name="chain"]').forEach(el=>el.addEventListener('change',()=>{
 addressInput.placeholder=selectedChain()==='ETH'?'0x... (Ethereum mainnet)':'bc1q... (Bitcoin mainnet)';
}));
if(apiBase){endpointInput.value=apiBase;checkHealth();}else setConnected(false,'Chưa cấu hình API');
})();