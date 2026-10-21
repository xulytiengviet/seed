# Seed Watch — Hybrid Mnemonic / Cloudflare Watch-Only

**Thiết kế an toàn:** Web công khai chỉ chấp nhận địa chỉ BTC/ETH. Seed phrase và private key không được gửi tới GitHub Pages, Cloudflare Workers, D1, R2 hay blockchain API.

## Thành phần

- `site/`: dashboard tiếng Việt cho GitHub Pages; chỉ nhập địa chỉ công khai.
- `offline/validator.html`: trình kiểm tra BIP39 checksum hoàn toàn ngoại tuyến (cần tải HTML về, KHÔNG mở bản online để nhập seed); không sinh/lưu/xuất private key.
- `worker/`: API Cloudflare Workers truy vấn BTC qua mempool.space, ETH qua Blockscout. Không cần khóa API cho bản thử nghiệm.
- `worker/schema.sql`: thống kê tổng hợp D1 tùy chọn, không lưu địa chỉ hay khóa cá nhân.
- `.github/workflows/`: GitHub Pages và Wrangler deployment.

## Triển khai

1. GitHub repository → **Settings → Pages → Source: GitHub Actions**. Workflow `pages.yml` chỉ xuất bản `site/` (không xuất bản trình offline).
2. Cloudflare → tạo Worker `seed-watch-api`. Tại GitHub → Settings → Secrets and variables → Actions, tạo **secrets** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (nhập trong giao diện GitHub; **không commit** token). Tạo **variable** `ENABLE_CLOUDFLARE_DEPLOY=true`. Workflow `worker.yml` có thể chạy `workflow_dispatch` hoặc sau khi push code Worker.
3. Sau deploy lấy URL Worker (*.workers.dev), đặt GitHub Actions **variable** `SEED_WORKER_URL=https://...`, chạy lại workflow Pages để gán API công khai.
4. (Tùy chọn) D1: tạo DB `seed_watch`, nạp `worker/schema.sql`, bind với Worker tên `DB`. Chỉ thống kê tổng hợp. R2 chưa cần ở MVP; nếu sử dụng sau này để lưu báo cáo, bucket phải private.
5. Để bảo vệ admin: cấu hình Cloudflare Access ở hostname riêng, điền **Worker environment variables** `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ADMIN_EMAILS`, Worker xác thực JWT Access và email được cấp quyền trên mỗi request.

### Lệnh cục bộ (Wrangler)

```bash
cd worker
npx wrangler deploy
npx wrangler d1 create seed_watch
# Sau khi có database_id, thêm [[d1_databases]] vào wrangler.toml:
# binding = "DB"; database_name = "seed_watch"; database_id = "<id>"
npx wrangler d1 execute seed_watch --remote --file=schema.sql
```

### Ranh giới và quyền

Không có chức năng thu thập/gửi mnemonic hoặc private key, không hiển thị "admin xem khóa". Bản offline hỗ trợ tiếng Anh và kiểm tra độ dài / từ điển / checksum BIP39, **không xác minh quyền sở hữu ví** và **không tạo địa chỉ**. Dashboard chỉ hỗ trợ BTC mainnet và ETH mainnet. API công khai không bảo đảm tuyệt đối về tính sẵn sàng của dịch vụ bên thứ ba.

Không dùng kết quả "0" để kết luận ví trống; các mạng, token, địa chỉ khác và trạng thái RPC có thể chưa được kiểm tra.

### Kiểm thử

```bash
node --check worker/src/index.js
```

Trước khi chạy production cần kiểm thử giới hạn tần suất Cloudflare WAF/Rate Limiting, chính sách lưu dữ liệu, HTTPS/CSP và cấu hình Access.

## Ghi chú chuyển đổi từ dự án cũ

Mã nguồn Mnemonic Seed Analyser 2021 trong ZIP cũ có chức năng hiển thị seed/private key và xuất PDF chứa dữ liệu nhạy cảm; **không sao chép nguyên ứng dụng đó vào Pages**. Mô hình mới chủ động tách trình kiểm tra BIP39 ngoại tuyến khỏi Dashboard Watch-Only.