# CMS Frontend Plan — Insurance Gateway

Kế hoạch tích hợp CMS (Vite + React + TS + Tailwind + shadcn/ui) vào codebase.
FE đặt tại `cms/` ngang hàng `src/`, build riêng, deploy `cms/dist` → `/var/www/cms` (nginx FE port 3000).

Backend đã implement (verify trong code) — FE phải bám đúng các contract sau.

---

## 0. Contract backend thực tế (KHÔNG được đoán khác)

### Auth (cookie-based, same-origin)
- `POST /admin/auth/login` body `{username, password}` → set 3 cookie (`access_token` path `/admin`, `refresh_token` path `/admin/auth`, `csrf_token` path `/admin` **non-httpOnly**) → trả `{username, expiresIn}`. **KHÔNG** trả token trong body. Login KHÔNG cần CSRF header.
- `POST /admin/auth/refresh` → đọc cookie `refresh_token`, xoay token, set cookie mới → trả `{expiresIn}`. KHÔNG cần CSRF, KHÔNG cần access. Throttle 10/60s.
- `POST /admin/auth/logout` / `logout-all` → cần access + **CSRF header**. Clear cookie.
- `GET /admin/auth/me` → cần access → `{adminId, username}`. Dùng để bootstrap trạng thái đăng nhập.
- Access token TTL ~15m (`expiresIn`). Refresh ~7 ngày.

### Quy tắc cookie → ảnh hưởng FE
- Cookie `access_token` chỉ gửi cho path `/admin/*`. Cookie `refresh_token` chỉ gửi cho `/admin/auth/*`. ⇒ **mọi API call dùng path tuyệt đối bắt đầu `/admin`**.
- `csrf_token` đọc được bằng JS (`document.cookie`). Mọi **POST/PATCH** (trừ login & refresh) phải gửi header `x-csrf-token` = giá trị cookie đó.
- PDF GCNBH ở `/files/policies/:maGiaodich.pdf` (NGOÀI `/admin`, không gửi cookie admin) → FE chỉ cần `<a href download>`.

### Pagination (keyset cursor)
- Mọi list trả `{ items: [...], nextCursor: string | null }`.
- Query: `limit` (default 50, max 100) + `cursor` (lấy từ `nextCursor` trang trước).
- `nextCursor === null` ⇒ hết dữ liệu. ⇒ FE dùng **"Tải thêm" / infinite scroll**, không phải số trang.

### Endpoints dùng cho FE
| Method | Path | Body/Query | Response |
|---|---|---|---|
| POST | `/admin/auth/login` | `{username,password}` | `{username,expiresIn}` + cookie |
| POST | `/admin/auth/refresh` | — | `{expiresIn}` + cookie |
| POST | `/admin/auth/logout` | (CSRF) | `{ok:true}` |
| GET | `/admin/auth/me` | — | `{adminId,username}` |
| GET | `/admin/stats/overview` | — | `{byStatus:[{status,count}],todayCount,weekCount,activePartners}` |
| GET | `/admin/stats/timeseries` | `?days=7\|30\|90` | `[{date:'YYYY-MM-DD',count}]` |
| GET | `/admin/transactions` | `status,partnerId,policyNumber,maGiaodich,productKind,from,to,limit,cursor` | `{items,nextCursor}` (item: id,maGiaodich,status,productKind,policyNumber,partner{id,name},createdAt,updatedAt) |
| GET | `/admin/transactions/:id` | — | full tx + `apiCallLogs[]` + `pdfUrl` |
| POST | `/admin/transactions/:id/reconcile` | (CSRF) | reconcile result |
| GET | `/admin/partners` | — | `[{id,name,clientId,status,rateLimit,allowedIps,createdAt,secrets:[{id,keyId,status,createdAt}]}]` (KHÔNG paginate) |
| POST | `/admin/partners` | (CSRF) `{name,clientId?,rateLimit?,allowedIps?,status?}` | `{id,clientId,keyId,secret}` ← **secret raw 1 lần** |
| POST | `/admin/partners/:id/rotate-secret` | (CSRF) `{revokeOld?}` | `{keyId,secret,...}` ← secret raw 1 lần |
| PATCH | `/admin/partners/:id` | (CSRF) `{name?,rateLimit?,allowedIps?,status?}` | partner |
| PATCH | `/admin/partners/:id/status` | (CSRF) `{status}` | partner |
| GET | `/admin/api-logs` | `direction,endpoint,maGiaodich,from,to,limit,cursor` | `{items,nextCursor}` |

Enum: `TxStatus = SUBMITTING|SUBMITTED_OK|SUBMITTED_FAIL|ISSUED|CALLBACK_TIMEOUT`. `PartnerStatus = ACTIVE|DISABLED`.

---

## 1. Scaffold & tooling

```
cd /Users/anhtuanbui/Downloads/i-g
pnpm create vite cms --template react-ts
cd cms
pnpm add react-router-dom @tanstack/react-query axios react-hook-form zod @hookform/resolvers recharts
pnpm add -D tailwindcss @tailwindcss/vite   # Tailwind v4 plugin
# shadcn/ui
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input table dialog dropdown-menu badge \
  sonner card form select label tabs skeleton separator sheet
```

### Loại trừ khỏi build NestJS
- Thêm `cms` vào `.gitignore`? KHÔNG — commit source. Nhưng `cms/dist`, `cms/node_modules` ignore.
- `tsconfig` NestJS (`tsconfig.json` gốc) đã `exclude` `node_modules`; thêm `"cms"` vào `exclude` để `nest build`/`tsc` không quét FE.
- `.dockerignore`/build artifact: đảm bảo `pnpm build` (Nest) không đụng `cms/`.

### vite.config.ts — dev proxy (same-origin giả lập)
```ts
server: {
  proxy: {
    '/admin': { target: 'http://localhost:8080', changeOrigin: false },
    '/files': { target: 'http://localhost:8080', changeOrigin: false },
  },
}
```
Dev backend phải set `ADMIN_COOKIE_SECURE=false` (http) để cookie set được. `changeOrigin:false` giữ host để SameSite=Strict hoạt động (same-origin localhost).

---

## 2. Cấu trúc thư mục

```
cms/src/
  main.tsx              # QueryClientProvider + RouterProvider + <Toaster/>
  App.tsx               # routes
  lib/
    api.ts              # axios instance + interceptor (xem mục 3)
    csrf.ts             # đọc cookie csrf_token
    auth.tsx            # AuthProvider/useAuth: me(), login(), logout(), trạng thái + refresh timer
    format.ts           # format ngày, status badge color, currency
  routes/
    login.tsx
    dashboard.tsx
    partners/{list,create-dialog,rotate-dialog,edit-dialog}.tsx
    transactions/{list,detail-sheet}.tsx
    api-logs/list.tsx
  components/
    app-shell.tsx       # sidebar + topbar + <Outlet/>, hiện username + logout
    require-auth.tsx     # route guard: chưa auth → /login
    data-table.tsx       # bảng + nút "Tải thêm" (cursor)
    json-viewer.tsx      # hiển thị request/response JSON đẹp
    status-badge.tsx
    ui/                  # shadcn generated
  hooks/
    use-transactions.ts use-partners.ts use-stats.ts use-api-logs.ts  # TanStack Query
```

---

## 3. Lớp API + Auth (phần kỹ thuật nhất)

### lib/csrf.ts
```ts
export const getCsrf = () =>
  document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1];
```

### lib/api.ts — axios
- `baseURL: '/'`, `withCredentials: true` (gửi cookie same-origin).
- **Request interceptor**: nếu method ∈ {post,patch,delete} và URL không phải `/admin/auth/login|refresh` → gắn `x-csrf-token: getCsrf()`.
- **Response interceptor (401 fallback)**:
  - Nếu 401 và chưa retry và URL ≠ `/admin/auth/refresh`:
    - dùng **single-flight** (1 promise refresh dùng chung) gọi `POST /admin/auth/refresh`.
    - refresh OK → retry request gốc 1 lần.
    - refresh fail → emit "logout" (clear auth state) → điều hướng `/login`.

### lib/auth.tsx — AuthProvider (proactive refresh + bootstrap)
- **Bootstrap**: khi mount, gọi `GET /admin/auth/me`. 200 → `authed`, lưu username. 401 → interceptor tự thử refresh; nếu vẫn fail → `unauthed`.
- **login(u,p)**: `POST /admin/auth/login` → lưu `expiresIn` → `scheduleRefresh(expiresIn)` → set authed.
- **Proactive timer** (`scheduleRefresh`):
  - parse `expiresIn` ("15m"/"900s"...) → ms. `setTimeout(refresh, ms - 60_000)` (refresh trước 60s).
  - refresh thành công → nhận `expiresIn` mới → `scheduleRefresh` lại (vòng lặp).
  - refresh fail → logout state → /login.
  - **Tab visibility**: trên `visibilitychange` → visible, nếu sắp/đã hết hạn thì refresh ngay (timer có thể bị throttle khi tab ẩn).
  - clear timer khi logout/unmount.
- **logout()**: `POST /admin/auth/logout` (CSRF tự gắn) → clear timer → state unauthed → /login.

> Lưu ý: access token nằm trong httpOnly cookie nên JS KHÔNG đọc được hạn thật. `expiresIn` từ login/refresh là nguồn duy nhất để hẹn giờ. Fallback 401 vẫn cần để chắc chắn (timer lệch do sleep máy, tab ẩn lâu).

---

## 4. Màn hình

### 4.1 Login (`/login`)
- Form `react-hook-form + zod` (username, password). Submit → `auth.login`. Lỗi 401 → toast "Sai thông tin đăng nhập". Đã auth → redirect `/`.

### 4.2 App shell + guard
- `require-auth.tsx`: nếu `auth.status==='loading'` → skeleton; `unauthed` → `<Navigate to="/login">`; `authed` → `<Outlet/>`.
- Sidebar: Dashboard / Giao dịch / Đối tác / API Logs. Topbar: username + "Đăng xuất".

### 4.3 Dashboard (`/`)
- `useStats`: `overview` + `timeseries`.
- Cards: tổng hôm nay, 7 ngày, partner active; breakdown theo `TxStatus` (badge màu).
- Biểu đồ recharts (AreaChart) từ `timeseries` (chọn 7/30/90 ngày).

### 4.4 Giao dịch (`/transactions`)
- Filter bar: status (select), maGiaodich, policyNumber, productKind, from/to (date).
- `data-table` cursor: hiển thị maGiaodich, status badge, sản phẩm, policyNumber, partner.name, createdAt. Nút **"Tải thêm"** khi `nextCursor`.
- Click row → `detail-sheet` (Sheet bên phải): thông tin tx, timeline `apiCallLogs` (direction/endpoint/time, expand JSON request/response qua `json-viewer`), callbackPayload, nút **Tải PDF** (`<a href={pdfUrl} download>` chỉ hiện khi `status==='ISSUED'`/có policyNumber), nút **Reconcile** (POST + CSRF, toast kết quả, invalidate query).

### 4.5 Đối tác (`/partners`)
- List (không paginate) bảng: name, clientId, status badge, rateLimit, allowedIps, số secret active.
- **Tạo** (Dialog): form → POST → **modal hiện `secret` + `keyId` raw 1 lần**, nút copy, cảnh báo "Lưu ngay, không hiện lại". Sau khi đóng → invalidate list.
- **Rotate secret** (Dialog xác nhận, checkbox revokeOld) → hiện secret mới 1 lần.
- **Sửa** (Dialog): name/rateLimit/allowedIps/status (PATCH).
- **Bật/tắt** nhanh: PATCH status.

### 4.6 API Logs (`/api-logs`)
- Filter: direction (select OUT_TO_PVI/IN_FROM_PARTNER), endpoint (contains), maGiaodich, from/to.
- `data-table` cursor. Row → xem JSON request/response (`json-viewer`).

---

## 5. Build & Deploy (theo PROJECT_OVERVIEW §4.7)

- `cd cms && pnpm build` → `cms/dist/`.
- Vì same-origin (nginx 3000 proxy `/admin`,`/files` về api_backend), **không cần `VITE_API_BASE_URL`** — axios `baseURL:'/'`.
- Deploy: `rsync -az cms/dist/ <user>@<FE>:/var/www/cms/` cho CẢ 2 FE (qua jump server).
- nginx port 3000 cần (bổ sung `pvi-test.conf` hoặc file `cms.conf`):
  ```
  root /var/www/cms;
  location / { try_files $uri $uri/ /index.html; }       # SPA routing
  location /admin/ { proxy_pass http://api_backend; ...proxy_common; }
  location /files/ { proxy_pass http://api_backend; ...proxy_common; }
  ```
  (proxy phải forward cookie + `x-csrf-token` — proxy mặc định forward header & cookie nên OK; chỉ cần `proxy_set_header Host`, `X-Forwarded-*` như proxy_common.conf.)
- Domain đề xuất `cms-stec.pvi.com.vn` → LB → FE:3000. **Cookie Secure=true ở prod** (HTTPS qua LB), SameSite=Strict OK vì FE và API cùng domain.

---

## 6. Rủi ro / lưu ý

- **Cookie path `/admin` vs domain CMS riêng**: nếu CMS chạy ở `cms-stec.pvi.com.vn` còn API set cookie cho domain đó thì OK (same-origin). Nhưng nếu API cookie set ở `api-stec.pvi.com.vn` (khác subdomain) thì cookie KHÔNG dùng chéo được → **CMS phải proxy `/admin` qua chính domain CMS** (đã làm ở nginx 3000). Xác nhận `ADMIN_COOKIE_DOMAIN` để trống (host-only) ⇒ buộc same-domain proxy. **Đây là điểm phải test sớm.**
- **SameSite=Strict + redirect**: login rồi điều hướng SPA nội bộ (client-side) nên không bị mất cookie. OK.
- **`admin.controller.ts` cũ** còn trong repo nhưng KHÔNG nằm trong `AdminModule` → route không active. Không ảnh hưởng FE; nên xóa để tránh nhầm lẫn (việc BE, ngoài phạm vi FE).
- **CSP backend** (`connectSrc 'self'`, `scriptSrc 'self'`) — CMS same-origin nên fetch `/admin` pass. Nhưng CSP đó áp cho response của API server; trang CMS do nginx static phục vụ, cần CSP riêng ở nginx 3000 (cho phép `'self'`; recharts inline-style có thể cần `style-src 'unsafe-inline'` hoặc dùng Tailwind class). Kiểm tra khi deploy.
- recharts kéo bundle ~100KB; chấp nhận được cho admin nội bộ. Có thể lazy-load route dashboard.

---

## 7. Thứ tự thực thi

1. Scaffold Vite + Tailwind + shadcn + tsconfig exclude + vite proxy. Chạy `pnpm dev`, mở trang trắng.
2. `lib/csrf`, `lib/api`, `lib/auth` + Login + require-auth + app-shell. Verify: login → /me → vào dashboard, refresh timer chạy, logout.
3. Dashboard (stats).
4. Transactions list + detail + reconcile + PDF.
5. Partners CRUD + secret-once modal.
6. API logs.
7. Build + nginx 3000 + rsync 2 FE + smoke test cookie/CSRF/refresh trên domain thật.
