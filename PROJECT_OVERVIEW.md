# PVIS Digital — AZP BH TNDS Xe máy / Insurance Gateway

Tổng hợp toàn bộ context về project, kiến trúc, deployment, API, đối tác và trạng thái hiện tại.

---

## 1. Mục đích & Phạm vi

**Tên dự án**: PVIS Digital — AZP BH TNDS xe máy
**Vai trò gateway**: BFF (Backend-for-Frontend) trung gian kết nối TMĐT bảo hiểm xe máy & ô tô giữa đối tác AZ-Plus / Innext, PVIS và Core PVI.

**Chức năng chính**:
- Tiếp nhận request từ partner (tính phí, tạo đơn, tra cứu).
- Giấu credential PVI khỏi partner; sign request server-side.
- Cấp GCNBH điện tử (TNDS ô tô + xe máy), lưu PDF, expose link tải.
- Nhận webhook callback từ PVI khi đơn được cấp.
- Đối soát giao dịch (reconcile cron).
- Quản lý partner cấp 2, secret, rate-limit, IP allowlist.
- Log toàn bộ giao dịch (`ApiCallLog`) cho audit.

**Đơn vị chủ quản**: PVI Phía Nam / P. NL&DVDK.
**Người yêu cầu hạ tầng**: Phạm Hoàng Linh (linhph2@pvi.com.vn).

---

## 2. Vai trò của tôi (Tuan)

- **Tech lead / DevOps** triển khai gateway lên môi trường production của PVIS.
- Trực tiếp setup: nginx FE, pm2 APP, Redis, Postgres, env, firewall, deploy code.
- Cấu hình & test API qua domain prod `https://api-stec.pvi.com.vn/`.
- Onboard partner: tạo client/secret, IP allowlist, rate-limit.
- Lên kế hoạch HA & scaling cho tải mục tiêu 50k đơn/ngày.

---

## 3. Stack công nghệ

| Tầng | Công nghệ |
|---|---|
| Runtime | Node.js 20+ |
| Framework | NestJS 11 (Express adapter) |
| ORM | Prisma 6 / `@prisma/client` 7 với adapter PG |
| DB | PostgreSQL 16, sync streaming replication |
| Cache / nonce / throttle store | Redis (ioredis + `@nest-lab/throttler-storage-redis`) |
| Process manager | pm2 cluster mode (4 instance/máy) |
| Reverse proxy | nginx |
| Package manager | pnpm (lockfile `.pnpm`) |
| HTTP client → PVI | axios qua `@nestjs/axios` |
| API docs | Swagger + Scalar (chỉ bật ở dev) |
| Security | helmet, CSP, HSTS, partner HMAC, JWT admin |

---

## 4. Kiến trúc Deployment Production

### 4.1 Sơ đồ luồng

```
Internet
   │
   ▼
[ LB (TTCNTT cấp) ]   ← terminate SSL, domain api-stec.pvi.com.vn
   │
   ├──► FE-01  192.168.242.23   (nginx :8080, :80, :3000)
   └──► FE-02  192.168.242.173  (nginx :8080, :80, :3000)
              │ (mỗi FE proxy tới CẢ 2 APP - full mesh)
              ▼
   ├──► APP-01 192.168.242.24   (NestJS :8080 + Redis :6379 dùng chung)
   └──► APP-02 192.168.242.174  (NestJS :8080)
              │
              ▼
   ├──► DB-01  192.168.92.18    (Postgres :5432 primary - ĐANG DÙNG)
   └──► DB-02  192.168.92.168   (Postgres standby - CHƯA SETUP HA)

Jump server (bastion) ── SSH → tất cả máy
```

### 4.2 Vai trò từng máy

| Máy | IP | Role | Phần mềm |
|---|---|---|---|
| LB | (TTCNTT cấp) | Edge / WAF / SSL terminate | F5/hạ tầng TTCNTT |
| FE-01 | 192.168.242.23 | Reverse proxy | nginx 1.x |
| FE-02 | 192.168.242.173 | Reverse proxy | nginx 1.x |
| APP-01 | 192.168.242.24 | NestJS gateway + Redis chung | Node 20, pm2 cluster, Redis 7 |
| APP-02 | 192.168.242.174 | NestJS gateway | Node 20, pm2 cluster |
| DB-01 | 192.168.92.18 | Postgres primary | Postgres 16 |
| DB-02 | 192.168.92.168 | Postgres standby (chưa active) | Postgres 16 |

### 4.3 Port mapping

| Service | Port FE expose | Port APP listen | Ghi chú |
|---|---|---|---|
| app (Hello World stub) | 80 | — | nginx return 200 stub |
| cms (Vite SPA / stub) | 3000 | — | nginx serve `/var/www/cms` static (kế hoạch) |
| api (NestJS) | 8080 | 8080 | nginx FE proxy `upstream api_backend` |
| Postgres | — | 5432 | DB internal |
| Redis | — | 6379 | trên APP-01, APP-02 trỏ qua |

### 4.7 CMS (Vite SPA — kế hoạch)

- Build static (`pnpm build` → `dist/`), serve từ nginx FE port 3000 (`/var/www/cms`).
- nginx block 3000 thêm `try_files $uri $uri/ /index.html` cho SPA routing.
- Cùng port 3000 proxy `/admin/*` và `/api/*` về `upstream api_backend` để tránh CORS.
- Env nhúng vào build time (`VITE_API_BASE_URL`) — đổi env phải rebuild.
- Deploy bằng `rsync` lên cả 2 FE giống nhau (qua jump server).
- Domain riêng đề xuất: `cms-stec.pvi.com.vn` → LB route về port 3000.

### 4.4 Bảng firewall

| Từ | Đến | Port |
|---|---|---|
| LB | FE-01, FE-02 | 80, 3000, 8080 |
| FE-01, FE-02 | APP-01, APP-02 | 8080 (full mesh) |
| APP-01, APP-02 | DB-01 | 5432, 6379 (APP-02 → APP-01 cho Redis) |
| DB-02 | DB-01 | 5432 (replication — chưa kích hoạt) |
| Jump | tất cả | 22 |

### 4.5 nginx FE (giống hệt nhau trên cả 2 FE)

Files:
- `/etc/nginx/conf.d/00-common.conf` — rate-limit zones, bad UA/URI maps, `set_real_ip_from` private RFC1918, upstream api_backend
- `/etc/nginx/conf.d/api.conf` — listen 8080, proxy `/api/pvi/*`, `/admin/*`, `/pvi/callback/*`, `/files/*`, `/health`
- `/etc/nginx/conf.d/pvi-test.conf` — stub port 80 (app) + 3000 (cms)
- `/etc/nginx/proxy_common.conf` — proxy headers chung

Defence-in-depth:
- Rate limit `20r/s/IP` (siết hơn cho `/admin/` = 5, `/pvi/callback/` = 10)
- `limit_conn 20`
- Chặn UA scanner (sqlmap, nikto…)
- Chặn URI probe (`.env`, `.git`, `wp-admin`…)
- Body limit 10MB
- Timeout chặt
- `server_tokens off`

### 4.6 pm2

`ecosystem.config.js` đã sửa để dùng `dotenv.parse(...)` (không dùng `env_file` vì pm2 v7 không hỗ trợ):
- `instances: 'max'` (cluster mode)
- `exec_mode: 'cluster'`
- `max_memory_restart: 400M`
- `wait_ready: true` + `enableShutdownHooks()` → reload zero-downtime

Auto-start sau reboot: systemd unit `pm2-insadmin.service` (`pm2 startup` + `pm2 save`).

---

## 5. Cấu hình môi trường (.env)

Trên cả 2 APP server (`/opt/apps/i-g/.env`):

```env
# PVI Core
PVI_BASE_URL=http://apiwebviewsrv.pvi.com.vn
PVI_CP_ID=7b17f63c39674d3f96a1375aa5693524
PVI_KEY=e2cd74ae20fb4f5384f644c3a8e55b40
PVI_EP_GET_FEE=/API_cp/ManagerApplication/Get_TongPhi_Auto_TNDS
PVI_EP_CREATE_ORDER=/API_CP/ManagerApplication/TaoDon_Auto
PVI_EP_CATEGORY=/API_CP/ManagerApplication/Get_DanhMuc
PVI_EP_GET_VEHICLE_TYPE=/API_CP/ManagerApplication/GetMaLoaiXe_Auto
PVI_EP_GET_POLICY=/API_CP/ManagerApplication/GetPolicyNumber
PVI_EP_GET_FEE_MOTO=/API_CP/ManagerApplication/Get_Phi_XeMay
PVI_EP_CREATE_ORDER_MOTO=/API_CP/ManagerApplication/TaoDon_XeMay

# DB
DATABASE_URL=postgresql://pvis_app:***@192.168.92.18:5432/pvis_prod

# Redis (1 instance trên APP-01)
REDIS_URL=redis://:***@192.168.242.24:6379

# Partner auth
PARTNER_AUTH_SKEW_SECONDS=300
PARTNER_AUTH_NONCE_TTL_SECONDS=300
PARTNER_AUTH_SIGNATURE_VERSION=v1
PARTNER_SECRET_MASTER_KEY=***

# App
PORT=8080
HTTP_TIMEOUT_MS=15000
CATEGORY_CACHE_TTL_SEC=21600
RECONCILE_INTERVAL_MIN=5
RECONCILE_GRACE_MIN=10
RECONCILE_MAX_ATTEMPTS=20

# Admin
ADMIN_JWT_SECRET=***
ADMIN_JWT_EXPIRES_IN=12h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=***

PUBLIC_BASE_URL=https://api-stec.pvi.com.vn
```

---

## 6. Domain & SSL

- **Domain prod**: `https://api-stec.pvi.com.vn`
- SSL terminate ở LB (TTCNTT lo). FE nginx nhận HTTP nội bộ.
- nginx FE dùng `set_real_ip_from 10/8, 172.16/12, 192.168/16` → LB-agnostic.

---

## 7. API Endpoints

Mọi endpoint `/api/pvi/*` đều cần partner sign **HMAC-SHA256** với 6 header:
`x-client-id`, `x-key-id`, `x-timestamp`, `x-nonce`, `x-signature`, `x-signature-version: v1`.

Canonical string: `METHOD\nPATH\nTIMESTAMP\nNONCE\nSHA256(BODY)`.

### 7.1 Partner-facing

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/pvi/catalog` | Lấy danh mục (loại xe, hãng xe, MDSD…) | Partner HMAC |
| POST | `/api/pvi/vehicle-type` | Lấy mã loại xe ô tô | Partner HMAC |
| POST | `/api/pvi/quote` | Tính phí TNDS ô tô | Partner HMAC |
| POST | `/api/pvi/order` | Tạo đơn TNDS ô tô | Partner HMAC |
| GET | `/api/pvi/order/:maGiaodich` | Tra cứu đơn (policy number) | Partner HMAC |
| POST | `/api/pvi/moto/quote` | Tính phí TNDS xe máy | Partner HMAC |
| POST | `/api/pvi/moto/order` | Tạo đơn TNDS xe máy | Partner HMAC |

### 7.2 PVI callback

| Method | Path | Mô tả |
|---|---|---|
| POST | `/pvi/callback` | Webhook PVI khi cấp GCNBH (verify MD5 sign) |

### 7.3 Admin

JWT bearer auth (đăng nhập bằng `ADMIN_USERNAME` + `ADMIN_PASSWORD`).

| Method | Path | Mô tả |
|---|---|---|
| POST | `/admin/auth/login` | Đăng nhập, trả JWT 12h |
| POST | `/admin/partners` | Tạo partner cấp 2 (trả về `clientId` + `keyId` + `secret` raw 1 lần) |
| GET | `/admin/partners` | Danh sách partner |
| POST | `/admin/partners/:id/rotate-secret` | Rotate secret |
| PATCH | `/admin/partners/:id` | Update name/rateLimit/allowedIps/status |
| PATCH | `/admin/partners/:id/status` | Bật/tắt |
| GET | `/admin/api-logs` | Tra `ApiCallLog` |

### 7.4 Khác

| Method | Path | Mô tả |
|---|---|---|
| GET | `/health` | DB + Redis health check |
| GET | `/health/live` | Liveness |
| GET | `/transaction` | List giao dịch (internal) |
| GET | `/transaction/:id` | Detail |
| POST | `/transaction/:id/reconcile` | Trigger reconcile thủ công |
| GET | `/files/policies/:maGiaodich.pdf` | Tải PDF GCNBH |

---

## 8. Chữ ký (Sign)

### 8.1 Partner → Gateway (HMAC-SHA256)

```
canonical = METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + SHA256(BODY hex)
signature = HMAC-SHA256(secret, canonical) hex
```

Guard: `PartnerAuthGuard` (verify chữ ký → check nonce store Redis 5 phút → set partner vào request).

### 8.2 Gateway → PVI (MD5)

PVI yêu cầu Sign = MD5(Key + tham_số...). Mỗi endpoint có format riêng (xem `src/pvi/sign.service.ts`):

| Endpoint | Sign formula |
|---|---|
| GetFee | MD5(Key + ma_trongtai + so_cho) |
| CreateOrder | MD5(Key + ma_giaodich) |
| GetCategory | MD5(Key + ten_dmuc + ma_user + ma_donvi + giatri_chon) |
| GetVehicleType | MD5(Key + SoChoNgoi + TrongTai + Ma_MDSD + LoaiHinh) |
| GetPolicy | MD5(Key + RequestId) |
| GetMotoFee | MD5(Key + ngay_dau + ngay_cuoi + loai_xe) |
| CreateMotoOrder | MD5(Key + bien_kiemsoat + email + '' + so_dienthoai + nhan_hieu + loai_xe + nam_sanxuat) |
| VerifyCallback | MD5(Key + RequestId + PolicyNumber + URL) |

(MD5 ở đây là yêu cầu hợp đồng tích hợp với PVI, KHÔNG dùng cho mục đích bảo mật mật khẩu.)

---

## 9. Đối tác (Partners)

| Tên | clientId | Mục đích | Status |
|---|---|---|---|
| Test Partner (smoke test ban đầu) | `999a7691-cbde-42ff-97dc-596204ce4e69` | Internal test | ACTIVE |
| **Innext** | `azp-client` | Đối tác chính (AZ-Plus / Innext) | ACTIVE |

PVI Core là upstream (không phải partner gửi đến): `apiwebviewsrv.pvi.com.vn`, CpId `7b17f63c39674d3f96a1375aa5693524`.

---

## 10. Database Schema (chính)

| Model | Vai trò | Chú ý |
|---|---|---|
| `Transaction` | Một giao dịch / đơn bảo hiểm | `maGiaodich` **`@unique`** (idempotency DB layer), `status` enum `TxStatus`, lưu inboundPayload, pviRequest/Response, policyNumber, pdfUrl, callbackPayload, `reconcileAttempts` |
| `ApiCallLog` | Log mọi call OUT_TO_PVI / IN_FROM_PARTNER | index theo `maGiaodich`, `createdAt`; có `request`/`response` JSON |
| `Partner` | Đối tác cấp 2 | `clientId` unique, status enum, `rateLimit`, `allowedIps[]` |
| `PartnerSecret` | Secret rotation | encrypt-at-rest qua `PARTNER_SECRET_MASTER_KEY` |
| `Admin` | Admin login | password bcrypt |

---

## 11. Trạng thái hiện tại (verified end-to-end)

- ✅ Health check `/health` 200, DB up, Redis up
- ✅ Admin login JWT
- ✅ Tạo partner Innext (`azp-client`)
- ✅ POST `/api/pvi/catalog` → 200 (LOAIXEAUTO 80 mục)
- ✅ POST `/api/pvi/quote` → 200 (TotalFee 480.700 VND cho xe < 6 chỗ, 1 năm)
- ✅ PVI whitelist IP egress đã được cấp
- ⏳ Chưa test end-to-end create order thật (cẩn trọng vì tạo dữ liệu PVI thật)
- ⏳ Chưa test xe máy quote + order trên prod (đã có 15 đơn trong DB từ test trước)

---

## 12. Đánh giá tải mục tiêu 50.000 đơn/ngày

Giả định tải dồn vào 10 giờ hành chính + giờ vàng + burst đỉnh:

| Mốc | Đơn/giây | Req/giây toàn hệ thống |
|---|---|---|
| Trung bình | ~1.4 | ~10–18 |
| Giờ vàng (~2x) | ~2.8 | ~20–36 |
| Burst 5 phút (~4x) | ~5.6 | ~40–70 |
| Burst 1 phút (đỉnh ~8–10x) | ~11–14 | **~80–180** |

(Mỗi đơn ~7–13 request HTTP do gồm catalog, quote, order, getPolicy, callback.)

### Bottlenecks

| Tầng | Đánh giá |
|---|---|
| LB + 2 FE nginx | Dư sức |
| 2 APP pm2 cluster | Căng ở burst đỉnh khi PVI chậm; cần tăng `instances`, giảm `HTTP_TIMEOUT_MS` |
| DB Postgres compute | Dư sức |
| **DB HA** | Bắt buộc, hiện CHƯA setup |
| **Redis HA** | Bắt buộc, hiện chỉ 1 Redis trên APP-01 |
| PVI Core upstream | Không biết — cần load test với PVI |
| **Idempotency code** | Bắt buộc, hiện chỉ có safety net DB `@unique` |
| **Disk retention** | Bắt buộc, hiện chưa có |

---

## 13. Việc cần làm trước go-live 50k/ngày

### 🔴 P0 — Phải làm

1. **Verify cả 2 APP cùng dùng 1 Redis (trên APP-01)**: `grep REDIS_URL /opt/apps/i-g/.env` trên APP-02 phải trỏ `192.168.242.24:6379`.
2. **Implement `IdempotencyService`**: cache `ma_giaodich → response` trong Redis 24h. Áp cho `createOrder` và `createMotoOrder`. Chống duplicate khi client/cron/LB retry.
3. **Tăng pm2 `instances` lên 6–8** mỗi APP để chịu I/O wait từ PVI.
4. **Giảm `HTTP_TIMEOUT_MS` xuống 5000–8000** ms.
5. **Setup DB-02 streaming sync standby** + viết runbook manual failover (3–4h).
6. **Hỏi PVI rate-limit + load test** với họ.

### 🟠 P1 — Trong 1–2 tuần đầu

7. **Redis Sentinel HA** (1 ngày).
8. **Circuit breaker** khi PVI lỗi.
9. **Backup `pg_dump` cron** hàng ngày.
10. **Retention cron** `DELETE FROM "ApiCallLog" WHERE "createdAt" < NOW() - INTERVAL '90 days'`.
11. **Monitoring**: alert `/health` fail, disk > 80%, PVI error rate > 5%.

### 🟡 P2 — Khi cần

12. **Async order pattern** với queue (BullMQ) nếu PVI là nút thắt cứng.
13. **Auto failover Patroni** nếu manual không đủ SLA.

---

## 14. Quy trình vận hành thường gặp

### Đổi `.env`

```bash
cd /opt/apps/i-g
nano .env
pm2 restart insurance-gateway --update-env
# Verify
sudo cat /proc/$(pgrep -f "dist/main.js" | head -1)/environ \
  | tr '\0' '\n' | grep <BIEN>
```
Làm trên **cả 2 APP** vì `.env` cục bộ từng máy.

### Reload zero-downtime

```bash
pm2 reload insurance-gateway --update-env
```

### Pm2 auto-start sau reboot

Đã setup `pm2-insadmin.service` qua systemd. Test bằng `sudo reboot`.

### Failover DB thủ công (sau khi setup DB-02)

```bash
# Trên DB-02
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main

# Trên cả 2 APP
sed -i 's|@192.168.92.18:|@192.168.92.168:|' /opt/apps/i-g/.env
pm2 reload insurance-gateway --update-env
```

### Test API qua gateway (mẫu)

Lưu `~/test-catalog.sh`, thay credential partner:
```bash
BASE=https://api-stec.pvi.com.vn
CLIENT_ID=...; KEY_ID=...; SECRET=...
BODY='{"ten_dmuc":"LOAIXEAUTO"}'
TS=$(date +%s); NONCE=$(uuidgen)
BH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $NF}')
SIG=$(printf '%s\n%s\n%s\n%s\n%s' POST /api/pvi/catalog $TS $NONCE $BH \
  | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')
curl -i -X POST "$BASE/api/pvi/catalog" \
  -H "Content-Type: application/json" \
  -H "x-client-id: $CLIENT_ID" -H "x-key-id: $KEY_ID" \
  -H "x-timestamp: $TS" -H "x-nonce: $NONCE" \
  -H "x-signature: $SIG" -H "x-signature-version: v1" \
  --data "$BODY"
```

---

## 15. Rủi ro chính & Mitigation

| Rủi ro | Hệ quả | Mitigation |
|---|---|---|
| 1 DB không HA | Sự cố giờ vàng = mất ~25k đơn/ngày | Setup DB-02 standby + runbook |
| 1 Redis không HA | Mất nonce/rate-limit/cache | Sentinel hoặc chấp nhận downtime ngắn |
| Duplicate đơn khi retry | Sai dữ liệu nghiệp vụ | DB `@unique` + IdempotencyService |
| PVI chậm/timeout | Hold worker → vỡ pool | Giảm timeout + circuit breaker |
| Disk DB 100GB đầy | Crash | Retention 90 ngày + alert |
| LB không kiểm soát được | Không biết rate-limit/WAF | Defense in depth ở FE nginx |

---

## 16. Tham chiếu nhanh

- Source code: NestJS app tại `/opt/apps/i-g/` trên 2 APP server.
- Build: `pnpm install --frozen-lockfile && pnpm prisma generate && pnpm prisma migrate deploy && pnpm run build`.
- Process: `pm2 start ecosystem.config.js` (đã sửa dùng `dotenv.parse`).
- Logs: `pm2 logs insurance-gateway --lines 200`.
- Swagger: chỉ bật khi `NODE_ENV=development` (đã tắt prod).
- API docs khi dev: `/docs` (Scalar).

---

*File này phản ánh trạng thái hệ thống tính đến hiện tại. Cập nhật khi có thay đổi kiến trúc / cấu hình lớn.*
