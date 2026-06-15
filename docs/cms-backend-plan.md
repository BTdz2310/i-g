# CMS Backend Plan — Insurance Gateway

Spec các thay đổi **backend (NestJS)** cần làm TRƯỚC khi build CMS FE (Vite + React).
Quyết định đã chốt:

- **Auth**: access JWT ngắn + **refresh token rotation + reuse detection (lưu DB)**.
- **Transport**: **httpOnly cookie** (same-origin nginx port 3000), SameSite=Strict + CSRF double-submit. Guard fallback Bearer header để giữ cURL smoke test.
- **Pagination**: **cursor-based (keyset)** theo `(createdAt, id)`.
- **Cấu trúc**: tách controller riêng theo domain trong module `admin/`.

Trạng thái hiện tại (đã verify trong code):
- `AdminController` gộp login + partners + api-logs ([src/admin/admin.controller.ts](../src/admin/admin.controller.ts)).
- `AdminAuthGuard` chỉ đọc `Authorization: Bearer` ([src/admin-auth/admin-auth.guard.ts](../src/admin-auth/admin-auth.guard.ts)).
- `AdminJwtService.sign` trả `{token, expiresIn}` HS256, payload `{adminId, username}`, **không có jti/refresh** ([src/admin-auth/jwt.service.ts](../src/admin-auth/jwt.service.ts)).
- `GET /transaction` dùng **PartnerAuthGuard** (HMAC), chỉ trả tx của partner ký request → admin KHÔNG xem được toàn hệ thống.
- `Transaction` đã có `@@index([status, createdAt])`, `@@index([partnerId])`, `@@index([policyNumber])`.
- PDF đã expose `/files/policies/:maGiaodich.pdf` (`getOrFetch`) → admin chỉ cần link, không cần endpoint PDF mới.
- `reconcileOne(maGiaodich)` nhận **maGiaodich** (không phải id).
- **Chưa có `enableCors`** → CMS bắt buộc same-origin (đúng kế hoạch nginx 3000).

---

## Phase 0 — Dependencies & env

### Packages
```
pnpm add cookie-parser
pnpm add -D @types/cookie-parser
```

### env mới (thêm vào src/config/env.ts zod schema)
```
ADMIN_ACCESS_TOKEN_TTL       default "15m"
ADMIN_REFRESH_TOKEN_TTL_DAYS default 7   (z.coerce.number)
ADMIN_COOKIE_SECURE          default true (z.coerce.boolean; false khi dev http)
ADMIN_COOKIE_DOMAIN          optional (để trống = host-only)
ADMIN_CSRF_SECRET            min 16 (ký double-submit CSRF token)
```
Giữ `ADMIN_JWT_SECRET` (access), thêm `ADMIN_REFRESH_SECRET` (min 32) — refresh token là opaque random, nhưng secret này để HMAC hash lưu DB.

`ADMIN_JWT_EXPIRES_IN` cũ: deprecate, thay bằng `ADMIN_ACCESS_TOKEN_TTL` (giữ alias 1 release để không vỡ .env prod).

### main.ts
- `app.use(cookieParser())` sau helmet.
- KHÔNG bật CORS (same-origin). Nếu sau này cần dev cross-origin, bật `enableCors({ origin, credentials: true })` có kiểm soát.

---

## Phase 1 — Auth: refresh token rotation + cookie + CSRF

### 1.1 Prisma model
```prisma
model AdminRefreshToken {
  id           String    @id @default(uuid())
  adminId      String
  admin        Admin     @relation(fields: [adminId], references: [id])
  tokenHash    String    @unique          // sha256(rawToken) — KHÔNG lưu plaintext
  familyId     String                     // nhóm token cùng 1 phiên login
  expiresAt    DateTime
  revokedAt    DateTime?
  replacedById String?    @unique         // link tới token kế tiếp (rotation chain)
  userAgent    String?
  ip           String?
  createdAt    DateTime  @default(now())

  @@index([adminId])
  @@index([familyId])
  @@index([expiresAt])
}
```
Thêm relation `refreshTokens AdminRefreshToken[]` vào model `Admin`. Migration: `pnpm prisma migrate dev --name admin_refresh_token`.

### 1.2 RefreshTokenService (src/admin-auth/refresh-token.service.ts)
- `issue(adminId, familyId?, meta)`:
  - sinh `rawToken = randomBytes(32).toString('base64url')`.
  - `tokenHash = hmacSha256(ADMIN_REFRESH_SECRET, rawToken)`.
  - `familyId = familyId ?? randomUUID()` (login mới = family mới).
  - lưu row, `expiresAt = now + REFRESH_TTL_DAYS`.
  - trả `{ rawToken, familyId, expiresAt }`.
- `rotate(rawToken, meta)`:
  - hash → tìm row theo `tokenHash`.
  - **Không tìm thấy** → throw Unauthorized (token giả/đã prune).
  - **revokedAt != null** (REUSE đã xoay rồi mà còn dùng) → **revoke toàn bộ family** (`updateMany familyId set revokedAt`) → throw Unauthorized "token reuse detected".
  - **expiresAt < now** → throw Unauthorized.
  - hợp lệ → issue token mới cùng `familyId`; set row cũ `revokedAt=now`, `replacedById=newId`. Trả token mới.
- `revokeFamily(familyId)` — dùng cho logout-all.
- `revoke(rawToken)` — logout 1 phiên.

### 1.3 AdminJwtService — access token
- Đổi TTL sang `ADMIN_ACCESS_TOKEN_TTL` (15m). Payload thêm `jti` (randomUUID) để truy vết. Giữ HS256.

### 1.4 Cookie helper (src/admin-auth/cookie.util.ts)
- `setAuthCookies(res, accessToken, refreshRaw, refreshExpiresAt)`:
  - `access_token`: httpOnly, Secure(env), SameSite=Strict, Path=`/admin`, maxAge=access TTL.
  - `refresh_token`: httpOnly, Secure, SameSite=Strict, **Path=`/admin/auth`** (chỉ gửi tới refresh/logout), maxAge=refresh TTL.
  - `csrf_token`: **KHÔNG** httpOnly (JS đọc để gắn header), SameSite=Strict, Path=`/admin`. Giá trị = random; double-submit.
- `clearAuthCookies(res)`.

### 1.5 CSRF guard (src/admin-auth/csrf.guard.ts)
- Áp cho mọi mutation admin (POST/PATCH/DELETE) TRỪ `auth/login` (chưa có session).
- So khớp header `x-csrf-token` với cookie `csrf_token` (double-submit). SameSite=Strict đã chặn phần lớn; double-submit là defense-in-depth.

### 1.6 AdminAuthGuard — đọc cookie + fallback Bearer
- Ưu tiên `req.cookies['access_token']`; nếu không có, fallback `Authorization: Bearer` (giữ cURL smoke test).
- Verify như cũ, set `req.admin`.

### 1.7 AdminAuthController (src/admin/admin-auth.controller.ts) — tách khỏi AdminController
| Method | Path | Mô tả |
|---|---|---|
| POST | `/admin/auth/login` | verify user/pass → issue access+refresh → set 3 cookie → trả `{username, expiresIn}` (KHÔNG trả token trong body nữa; nếu cần backward-compat thì trả sau cờ env) |
| POST | `/admin/auth/refresh` | đọc cookie refresh → `rotate()` → set cookie mới. Throttle chặt (10/60s). |
| POST | `/admin/auth/logout` | revoke phiên hiện tại + clear cookie |
| POST | `/admin/auth/logout-all` | revokeFamily / tất cả family của admin |
| GET  | `/admin/auth/me` | trả `{username, adminId}` (FE kiểm tra đã đăng nhập) — guard access |

Giữ login throttle 5/60s như hiện tại.

### 1.8 Cron prune (src/admin-auth/refresh-cleanup.cron.ts)
- `@Cron` hằng ngày: `deleteMany where expiresAt < now() OR revokedAt < now() - interval '7d'`.

---

## Phase 2 — Admin Transactions (gap quan trọng nhất)

`AdminTransactionsController` (src/admin/admin-transactions.controller.ts), guard = AdminAuthGuard.

### Cursor pagination contract (dùng chung mọi list)
- Query: `limit` (default 50, max 100), `cursor` (base64url của `{createdAt, id}` từ item cuối trang trước), `direction` mặc định mới→cũ.
- Response: `{ items: [...], nextCursor: string | null }`.
- Keyset SQL: `WHERE (createdAt, id) < (cursorCreatedAt, cursorId) ORDER BY createdAt DESC, id DESC LIMIT limit+1`. Lấy `limit+1` để biết còn trang sau.
- Helper chung: `src/common/pagination/keyset.ts` (encode/decode cursor, buildWhere).

| Method | Path | Query | Mô tả |
|---|---|---|---|
| GET | `/admin/transactions` | `status, partnerId, policyNumber, maGiaodich, productKind, from, to, limit, cursor` | List toàn hệ thống, keyset. Trả field gọn (KHÔNG kèm payload nặng): id, maGiaodich, status, productKind, policyNumber, partner{id,name}, createdAt, updatedAt. |
| GET | `/admin/transactions/:id` | — | Detail đầy đủ + `apiCallLogs` (theo maGiaodich, asc) + callbackPayload + pdfUrl. |
| POST | `/admin/transactions/:id/reconcile` | — | Tra tx → gọi `reconcile.reconcileOne(tx.maGiaodich)`. CSRF guard. |

PDF: FE link thẳng `/files/policies/:maGiaodich.pdf` (đã có). Không thêm endpoint.

> Lưu ý filter `from/to` + cursor: khi có filter thời gian, cursor vẫn keyset trên createdAt nhưng AND thêm range. Đảm bảo index `(status, createdAt)` được dùng; cân nhắc thêm `@@index([createdAt, id])` nếu query không lọc status (migration nhỏ).

---

## Phase 3 — Admin Stats (dashboard)

`AdminStatsController` (src/admin/admin-stats.controller.ts), guard AdminAuthGuard.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/stats/overview` | `groupBy status` (count), tổng hôm nay / 7 ngày, số partner ACTIVE. 1-2 query `groupBy` + `count`. |
| GET | `/admin/stats/timeseries` | `?days=7\|30` — đếm tx theo ngày (raw SQL `date_trunc('day', createdAt)`), trả mảng `{date, count}` cho recharts. |

Cache nhẹ overview trong Redis 30–60s (tùy chọn) để giảm tải khi nhiều admin mở dashboard.

---

## Phase 4 — Nâng cấp /admin/api-logs

Chuyển sang `AdminApiLogsController` (hoặc giữ trong AdminController):
- Bỏ cap cứng `take: 200`.
- Cursor pagination giống transactions.
- Thêm filter: `direction` (OUT_TO_PVI / IN_FROM_PARTNER), `endpoint` (contains), `maGiaodich`, `from/to`.
- Response: `{ items, nextCursor }`.
- Cần index: kiểm tra `ApiCallLog` đã có `@@index([maGiaodich])`, `@@index([createdAt])`; thêm `@@index([direction, createdAt])` nếu filter direction phổ biến.

---

## Phase 5 — Refactor cấu trúc module admin

```
src/admin/
  admin.module.ts                 # khai báo tất cả controller + provider mới
  admin-auth.controller.ts        # login/refresh/logout/me  (MỚI, tách ra)
  admin-partners.controller.ts    # partners CRUD (tách từ admin.controller.ts cũ)
  admin-transactions.controller.ts
  admin-stats.controller.ts
  admin-api-logs.controller.ts
  dto/...
src/admin-auth/
  jwt.service.ts                  # access token (sửa TTL + jti)
  refresh-token.service.ts        # MỚI
  cookie.util.ts                  # MỚI
  csrf.guard.ts                   # MỚI
  admin-auth.guard.ts             # sửa: cookie + fallback bearer
  refresh-cleanup.cron.ts         # MỚI
```
Xóa `admin.controller.ts` cũ sau khi tách (giữ test, cập nhật).

---

## Thứ tự làm & test

1. Phase 0 (deps, env, cookieParser) — không breaking.
2. Phase 1 (auth rotation + cookie + CSRF) — migration + unit test rotate/reuse. **Test reuse detection**: dùng refresh cũ sau khi đã rotate → phải revoke family.
3. Phase 2 (transactions) — test keyset cursor + filter.
4. Phase 3 (stats), Phase 4 (api-logs).
5. Phase 5 refactor cuối (sau khi route chạy ổn) để tránh vỡ giữa chừng.

### Smoke test cURL (giữ Bearer fallback)
- login → lấy cookie (`-c jar`), gọi `/admin/transactions` với `-b jar` + `x-csrf-token`.
- Bearer cũ: `Authorization: Bearer <access>` vẫn hoạt động cho GET (guard fallback).

---

## Câu hỏi mở / rủi ro

- **Migration prod**: thêm bảng `AdminRefreshToken` + có thể 1-2 index mới → chạy `prisma migrate deploy` trên DB-01. Index trên bảng lớn (`ApiCallLog`, `Transaction`) nên tạo `CONCURRENTLY` nếu bảng đã nhiều dữ liệu (Prisma migrate không tự `CONCURRENTLY` — cân nhắc viết SQL raw trong migration).
- **Secure cookie ở dev**: dev chạy http → `ADMIN_COOKIE_SECURE=false`; prod sau LB SSL → true. Lưu ý LB terminate SSL, backend nhận HTTP nội bộ → cookie Secure vẫn set được vì trình duyệt nói chuyện HTTPS với LB (same-origin domain https).
- **Single Redis** hiện tại: refresh token ở Postgres (bền) nên không phụ thuộc Redis HA — tốt.
- **Đa admin**: hiện chỉ 1 admin từ env. Nếu sau này nhiều admin, model `Admin` đã sẵn; logout-all theo adminId hoạt động đúng.
