export function adminPage() {
return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Seed Watch · Quản trị</title>
<style>
*{box-sizing:border-box}body{font:14px/1.7 system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f5f8f6;color:#1b3937}
header{background:#132f30;color:white;padding:24px 28px}header h1{margin:0;font-size:24px}
main{max-width:1050px;margin:32px auto;padding:0 22px}
.card{background:white;border:1px solid #e0e9e4;padding:27px;border-radius:15px;margin-bottom:18px}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:1.6px;color:#609485}
h2{font-size:19px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px;border-bottom:1px solid #e9efeb}th{color:#718e80;font-size:11px}
.note{color:#63786f}button{background:#157b65;border:0;color:white;border-radius:8px;padding:10px 15px;cursor:pointer}
@media(max-width:600px){th,td{font-size:11px;padding:8px}header h1{font-size:18px}}
</style></head><body><header><h1>◈ Seed Watch · Trung tâm quản trị</h1><small>Cloudflare Access + xác thực JWT + allowlist email</small></header>
<main><section class="card"><div class="eyebrow">ACCESS CONTROL</div><h2>Quản trị thống kê ẩn danh</h2><p class="note">Chỉ hiển thị số lượt truy vấn tổng hợp; không thu thập địa chỉ ví, seed phrase hoặc private key. D1 là tùy chọn.</p><button id="refresh">Tải lại số liệu</button><p id="status" role="status">Đang xác minh dữ liệu…</p></section>
<section class="card"><h2>30 bản ghi thống kê gần nhất</h2><div style="overflow:auto"><table><thead><tr><th>Ngày</th><th>Mạng</th><th>Truy vấn</th><th>Thành công</th></tr></thead><tbody id="rows"></tbody></table></div></section></main>
<script>
const rows=document.getElementById('rows'),status=document.getElementById('status');
async function load(){
 rows.replaceChildren(); status.textContent='Đang tải dữ liệu…';
 try {
  const res=await fetch('/v1/admin/stats',{cache:'no-store',credentials:'same-origin'});
  if(!res.ok)throw new Error('API quản trị trả về HTTP '+res.status);
  const data=await res.json();
  if(!data.database_connected){status.textContent='Chưa kết nối D1 — cấu hình binding DB để hiển thị thống kê.';return;}
  const entries=Array.isArray(data.stats)?data.stats:[];
  for(const item of entries){
   const tr=document.createElement('tr');
   for(const val of [item.day,item.chain,item.total_scans,item.successful_scans]){
    const td=document.createElement('td');td.textContent=String(val);tr.append(td);
   } rows.append(tr);
  }
  status.textContent='Đã đọc '+entries.length+' bản ghi từ Cloudflare D1.';
 }catch(e){status.textContent='Lỗi xác thực hoặc truy vấn: '+e.message;}
}
document.getElementById('refresh').addEventListener('click',load);load();
</script></body></html>`;
}
