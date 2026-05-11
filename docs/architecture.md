# Insurance Gateway — Kiến trúc

> **Vai trò**: thin BFF cho PVI. Giấu credential, sign server-side, log giao dịch, nhận callback.
> Doc PVI tham chiếu: v1.0 (08/05/2026).

---

## 1. Trách nhiệm gateway

1. **Giấu `CpId` + `Key`** — chỉ tồn tại server-side, FE không bao giờ thấy.
2. **Sign MD5 server-side** — FE gửi payload nghiệp vụ thuần, gateway thêm `CpId` + `Sign`.
3. **Sinh `ma_giaodich`** (UUID) — không tin client tự sinh.
4. **Log mọi call** in/out để đối soát.
5. **Nhận callback PVI** — verify sign, lưu kết quả.
6. **Reconcile** khi callback miss (PVI chỉ retry callback 3 lần).

## Out of scope

Doc PVI v1.0 không có, gateway lõi không bao gồm — nếu cần, làm **lớp ngoài**:

- Thanh toán end-user / cổng thanh toán / payment deadline.
- Khuyến mãi / promo code.
- Draft policy / autosave.
- Bảng giá tra cứu sẵn.
- Logic nghiệp vụ chọn xe / form / gửi mail KH.

## TBD (chờ làm rõ với khách)

- **Forward webhook xuống đối tác phía sau**: khi gateway nhận callback từ PVI, có cần POST tiếp sang URL hệ thống đối tác, hay đối tác tự poll `GET /api/pvi/order/:maGD`? Nếu có → cần `PARTNER_WEBHOOK_URL` + retry policy.
- Endpoint Moto chính thức từ PVI (đang tạm dùng endpoint Auto qua env).
- Confirm `objCP.code` trong sign `TaoDon` = `Key`.

---

## 2. Nguyên tắc thiết kế (đặc biệt cho lớp gọi PVI)

Cốt lõi của gateway là **lớp `pvi/` gọi sang PVI**. Đây là chỗ doc PVI hay đổi nhất, nên thiết kế phải để **đổi 1 chỗ, không lan ra**.

1. **Mỗi PVI API = 1 cặp (DTO + method client + method sign)**, không gì hơn. Không chia sẻ logic giữa các API (vì PVI mỗi API 1 kiểu).
2. **Endpoint, base URL, key, CpId** — chỉ trong env. Code không hardcode.
3. **Công thức sign** — mỗi API 1 hàm tên rõ trong `SignService`. Doc đổi thứ tự field → sửa đúng 1 hàm.
4. **DTO mirror tài liệu PVI 1-1** (giữ camelCase/snake_case **đúng như doc** để khỏi nhầm khi đối chiếu). Một biến đổi tên xảy ra chỉ ở **biên với FE/đối tác** (lớp `proxy/`).
5. **Client method ký hiệu uniform**: nhận DTO input nghiệp vụ, **tự gắn `CpId` + `Sign`**, trả DTO output đã parse. Caller (proxy/callback) **không bao giờ** đụng `CpId`, `Sign`, hay HTTP raw.
6. **Mọi response PVI đều normalize**: `Status === "00"` → trả `data`, ngược lại throw `PviBusinessError(status, message)`. Caller chỉ try/catch nghiệp vụ, không lo decode.
7. **Tự log mọi call**: client wrap sẵn audit, caller không phải nhớ log thủ công.
8. **Tạm dùng endpoint Auto cho Moto**: không phân nhánh logic auto/moto, chỉ cấu hình endpoint qua env. Khi PVI cấp endpoint Moto → đổi env (và nếu DTO khác thì thêm 1 file DTO biến thể, dùng cùng SignService).
9. **Idempotent theo `ma_giaodich`**: gateway sinh, lưu DB, retry không tạo đơn trùng phía PVI.

---

## 3. Cấu hình môi trường

```env
# PVI base
PVI_BASE_URL=http://piastest.pvi.com.vn
PVI_CP_ID=48920ebc3c4249f69897da2ba8db8749
PVI_KEY=abadb47c8bbf41069fe700cf573473ed

# Endpoints — TẠM dùng Auto cho Moto, đổi qua env khi PVI cấp Moto
PVI_EP_GET_FEE=/API_cp/ManagerApplication/Get_TongPhi_Auto_TNDS
PVI_EP_CREATE_ORDER=/API_CP/ManagerApplication/TaoDon_Auto
PVI_EP_CATEGORY=/API_CP/ManagerApplication/Get_DanhMuc
PVI_EP_GET_VEHICLE_TYPE=/API_CP/ManagerApplication/GetMaLoaiXe_Auto
PVI_EP_GET_POLICY=/API_CP/ManagerApplication/GetPolicyNumber

# Hạ tầng
DATABASE_URL=postgresql://user:pass@localhost:5432/insurance_gateway
REDIS_URL=redis://localhost:6379
PORT=3000

# Hành vi
CATEGORY_CACHE_TTL_SEC=21600
RECONCILE_INTERVAL_MIN=5
RECONCILE_GRACE_MIN=10
RECONCILE_MAX_ATTEMPTS=20
HTTP_TIMEOUT_MS=15000
```

---

## 4. Cấu trúc thư mục

```
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── env.ts                    # zod validate, throw nếu thiếu
│   └── pvi.config.ts             # gom các env PVI thành 1 object inject
├── common/
│   ├── crypto/md5.util.ts
│   ├── errors/pvi-business.error.ts
│   └── logger/mask.util.ts       # mask Sign/CpId/Key trong log
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── pvi/                          # ❶ LỚP PVI — chỗ DUY NHẤT chạm PVI
│   ├── pvi.module.ts
│   ├── pvi.client.ts             # 1 method per API, tự sign + log + normalize
│   ├── sign.service.ts           # 1 method per API
│   └── dto/
│       ├── fee.dto.ts
│       ├── create-order.dto.ts
│       ├── category.dto.ts
│       ├── vehicle-type.dto.ts
│       ├── get-policy.dto.ts
│       └── callback.dto.ts
├── audit/
│   ├── audit.module.ts
│   └── audit.service.ts          # ghi ApiCallLog
├── proxy/                        # ❷ ENDPOINT FE/ĐỐI TÁC — 1-1 với PVI
│   ├── proxy.module.ts
│   ├── catalog.controller.ts
│   ├── vehicle-type.controller.ts
│   ├── quote.controller.ts
│   ├── order.controller.ts
│   └── policy.controller.ts
├── callback/
│   ├── callback.module.ts
│   └── callback.controller.ts
├── reconcile/
│   ├── reconcile.module.ts
│   └── reconcile.service.ts
└── admin/
    ├── admin.module.ts
    └── admin.controller.ts

prisma/
└── schema.prisma
```

**Quy tắc phụ thuộc**: chỉ có chiều `proxy/`, `callback/`, `reconcile/` → `pvi/`. Không bao giờ có chiều ngược lại. `pvi/` không biết tới Transaction, không biết tới HTTP server. Nó là 1 SDK PVI nội bộ.

---

## 5. Lớp `pvi/` — chi tiết thiết kế

### 5.1. SignService — 1 method per API, công thức rõ ràng

```ts
// src/pvi/sign.service.ts
@Injectable()
export class SignService {
  constructor(private readonly cfg: PviConfig) {}

  // Sign = MD5(Key + ma_trongtai + so_cho)
  forGetFee(p: { ma_trongtai: string; so_cho: number }): string {
    return md5(this.cfg.key + p.ma_trongtai + String(p.so_cho));
  }

  // Sign = MD5(Key + ma_giaodich)   ← giả định "objCP.code" trong doc = Key, cần PVI confirm
  forCreateOrder(p: { ma_giaodich: string }): string {
    return md5(this.cfg.key + p.ma_giaodich);
  }

  // Sign = MD5(Key + ten_dmuc + ma_user + ma_donvi + giatri_chon)
  forCategory(p: { ten_dmuc: string; ma_user: string; ma_donvi: string; giatri_chon: string }): string {
    return md5(this.cfg.key + p.ten_dmuc + p.ma_user + p.ma_donvi + p.giatri_chon);
  }

  // Sign = MD5(Key + SoChoNgoi + TrongTai + Ma_MDSD + LoaiHinh)
  forGetVehicleType(p: { SoChoNgoi: number; TrongTai: number; Ma_MDSD: string; LoaiHinh: string }): string {
    return md5(this.cfg.key + p.SoChoNgoi + p.TrongTai + p.Ma_MDSD + p.LoaiHinh);
  }

  // Sign = MD5(Key + RequestId)
  forGetPolicy(p: { RequestId: string }): string {
    return md5(this.cfg.key + p.RequestId);
  }

  // Verify callback: Sign = MD5(Key + RequestId + PolicyNumber + URL)
  verifyCallback(p: { RequestId: string; PolicyNumber: string; URL: string; Sign: string }): boolean {
    const expected = md5(this.cfg.key + p.RequestId + p.PolicyNumber + p.URL);
    return timingSafeEqual(expected, p.Sign);
  }
}
```

**Khi doc PVI đổi** → sửa **đúng 1 method tương ứng**. Có unit test pin từng công thức để không sửa nhầm.

### 5.2. PviClient — 1 method per API, uniform interface

```ts
// src/pvi/pvi.client.ts
@Injectable()
export class PviClient {
  constructor(
    private readonly cfg: PviConfig,
    private readonly sign: SignService,
    private readonly audit: AuditService,
    private readonly http: AxiosInstance,
  ) {}

  getCategory(input: CategoryInput): Promise<CategoryItem[]> {
    return this.call(this.cfg.ep.category, {
      ...input,
      CpId: this.cfg.cpId,
      Sign: this.sign.forCategory(input),
    }).then(parseCategory);
  }

  getVehicleType(input: VehicleTypeInput): Promise<VehicleTypeItem[]> { /* tương tự */ }

  getFee(input: FeeInput): Promise<FeeResult> { /* tương tự */ }

  createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    // input đã có ma_giaodich do caller (OrderController) sinh
    return this.call(this.cfg.ep.createOrder, {
      ...input,
      CpId: this.cfg.cpId,
      Sign: this.sign.forCreateOrder(input),
    }).then(parseCreateOrder);
  }

  getPolicy(maGiaodich: string): Promise<GetPolicyResult> { /* tương tự */ }

  // Helper riêng tư — wrap HTTP, audit, normalize Status
  private async call(endpoint: string, body: unknown): Promise<unknown> {
    const start = Date.now();
    try {
      const res = await this.http.post(endpoint, body, { timeout: this.cfg.timeoutMs });
      await this.audit.logOut(endpoint, body, res.data, res.status, Date.now() - start);
      if (res.data?.Status !== '00') {
        throw new PviBusinessError(res.data?.Status, res.data?.Message);
      }
      return res.data;
    } catch (err) {
      await this.audit.logOut(endpoint, body, errToJson(err), 599, Date.now() - start);
      throw err;
    }
  }
}
```

**Đặc tính cố định của mọi method client**:

- Input là DTO **không có** `CpId`, `Sign` (caller không biết tới chúng).
- Output là DTO đã parse, nếu `Status≠00` → throw, không trả về error union.
- Audit tự ghi, caller không phải gọi log thủ công.
- HTTP timeout, mask field nhạy cảm, retry network — đều đặt ở `call()`, mỗi method API không lặp lại.

### 5.3. DTO

Mỗi API 1 file trong [src/pvi/dto/](../src/pvi/dto/), giữ tên field **đúng như doc PVI** (kể cả viết hoa/snake_case khác nhau). Lý do: khi đối chiếu với tài liệu PVI hoặc khi PVI gửi log, không phải dịch tên qua lại.

Ví dụ [fee.dto.ts](../src/pvi/dto/fee.dto.ts):

```ts
// Đúng tên trong doc PVI — KHÔNG đổi sang camelCase
export interface FeeInput {
  ma_trongtai: string;
  so_cho: number;
  ma_mdsd: string;
  giodau: string;
  giocuoi: string;
  ngaydau: string;
  ngaycuoi: string;
  // ... các flag XeTaxi, XeBus...
  ma_loaixe: string;
  thamgia_tndsbb: boolean;
  // ...
}

export interface FeeResult {
  Status: string;
  Message: string;
  TotalFee: string;       // "phi|VAT"
  phi_tndsbb: string;
  ma_loaixe: string;
  phi_lpx: string;
}
```

Nơi đổi snake_case → camelCase chỉ xảy ra ở **lớp `proxy/`** khi cần expose ra API public của gateway.

---

## 6. DB schema

```prisma
model Transaction {
  id                String    @id @default(uuid())
  maGiaodich        String    @unique
  productKind       String                       // "MOTO" | "AUTO"
  status            TxStatus
  inboundPayload    Json                         // body từ FE/đối tác
  pviRequest        Json?                        // payload đã sign (mask Sign)
  pviResponse       Json?
  pviPrKey          String?
  policyNumber      String?
  serialNumber      String?
  pdfUrl            String?
  callbackPayload   Json?
  callbackAt        DateTime?
  reconcileAttempts Int       @default(0)
  lastError         String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  @@index([status, createdAt])
  @@index([policyNumber])
}

enum TxStatus {
  SUBMITTING        // đang gọi TaoDon
  SUBMITTED_OK      // PVI Status=00, chờ callback
  SUBMITTED_FAIL    // PVI Status≠00
  ISSUED            // có PolicyNumber + URL
  CALLBACK_TIMEOUT  // hết retry reconcile, cần can thiệp
}

model ApiCallLog {
  id          String   @id @default(uuid())
  direction   String   // OUT_TO_PVI | IN_FROM_PVI | IN_FROM_CLIENT
  endpoint    String
  maGiaodich  String?
  request     Json?
  response    Json?
  statusCode  Int?
  durationMs  Int?
  errorMsg    String?
  createdAt   DateTime @default(now())
  @@index([maGiaodich])
  @@index([createdAt])
}
```

`Transaction` chỉ tạo cho `TaoDon` (có lifecycle). Các API stateless khác (`Get_DanhMuc`, `Get_TongPhi`, ...) chỉ ghi `ApiCallLog`.

---

## 7. Endpoints public của gateway

### FE/đối tác → gateway
| Method | Path | Wrap PVI API |
|---|---|---|
| POST | `/api/pvi/catalog` | `Get_DanhMuc` |
| POST | `/api/pvi/vehicle-type` | `GetMaLoaiXe_Auto` |
| POST | `/api/pvi/quote` | `Get_TongPhi_*_TNDS` |
| POST | `/api/pvi/order` | `TaoDon_*` (gateway sinh `ma_giaodich`, trả về body) |
| GET | `/api/pvi/order/:maGiaodich` | `GetPolicyNumber` |

FE/đối tác **không gửi** `CpId`, `Sign`, `ma_giaodich` — gateway thêm/sinh.

### PVI → gateway
| Method | Path | |
|---|---|---|
| POST | `/pvi/callback` | Verify sign → cập nhật `Transaction` → trả `{Status:"00"}` |

### Admin (chưa auth, sẽ bọc Guard sau)
| Method | Path | |
|---|---|---|
| GET | `/admin/transactions` | List + filter (status, BKS, policyNumber, date) |
| GET | `/admin/transactions/:id` | Chi tiết + ApiCallLog liên quan |
| POST | `/admin/transactions/:id/reconcile` | Trigger pull `GetPolicyNumber` ngay |
| GET | `/admin/api-logs` | Log thô |

---

## 8. Callback handler

```
1. Verify sign — sai → trả {Status:"-105", Message:"Invalid sign"} (HTTP 200, không 401, để tránh PVI retry vô tận khi đôi bên hiểu nhầm)
2. Tìm Transaction theo maGiaodich (= RequestId trong body)
3. Idempotent: nếu đã ISSUED và policyNumber khớp → trả {Status:"00"}
4. Update: status=ISSUED, policyNumber, serialNumber, pdfUrl, callbackPayload, callbackAt
5. Trả {Status:"00", Message:"OK"}
6. (TBD với khách) Forward webhook xuống đối tác phía sau
```

PVI retry callback tối đa 3 lần → handler phải idempotent.

---

## 9. Reconcile cron

Mỗi `RECONCILE_INTERVAL_MIN` phút:

```sql
SELECT * FROM "Transaction"
WHERE status = 'SUBMITTED_OK'
  AND updatedAt < now() - INTERVAL 'RECONCILE_GRACE_MIN min'
  AND reconcileAttempts < RECONCILE_MAX_ATTEMPTS
```

Với mỗi tx → `pviClient.getPolicy(maGiaodich)`:
- Có `PolicyNumber` → ISSUED.
- Không → tăng `reconcileAttempts`, vượt max → `CALLBACK_TIMEOUT`.

---

## 10. Logging / mask

- Mọi call sang PVI: `AuditService` ghi `ApiCallLog` (direction, endpoint, request, response, duration).
- **Mask** trước khi log: `Sign`, `CpId`, `Key` thay bằng `***`. Util dùng chung trong [common/logger/mask.util.ts](../src/common/logger/mask.util.ts).
- Lỗi network/timeout: vẫn log với `statusCode=599` + `errorMsg`.

---

## 11. Test

- `sign.service.spec.ts` — pin từng công thức MD5 với fixture cứng (không phụ thuộc PVI thật).
- `pvi.client.spec.ts` — nock mock từng endpoint, test happy + Status≠00 + timeout.
- `callback.controller.spec.ts` — verify sign, idempotent.
- `reconcile.service.spec.ts` — test grace period, max attempts.

---

## 12. Khi PVI đổi tài liệu — checklist sửa nhanh

| Thay đổi từ PVI | Sửa ở đâu |
|---|---|
| Đổi base URL / endpoint path | `.env` |
| Đổi `CpId` / `Key` | `.env` |
| Đổi thứ tự field trong sign | 1 method trong [sign.service.ts](../src/pvi/sign.service.ts) + test tương ứng |
| Thêm/bớt field trong request | DTO trong [src/pvi/dto/](../src/pvi/dto/) |
| Đổi mã lỗi | `PviBusinessError` mapping (nếu có) |
| Cấp endpoint Moto riêng | `.env` (đổi `PVI_EP_*`); nếu payload khác → thêm DTO biến thể, dùng lại `SignService` |
| Đổi cơ chế callback (thêm field) | DTO callback + `SignService.verifyCallback` |

Tất cả những thay đổi trên **không động tới**: `proxy/`, `callback/` (logic), `reconcile/`, `audit/`, schema DB.
