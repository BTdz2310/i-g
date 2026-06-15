# Hướng dẫn test bằng curl trên UAT

Tài liệu này hướng dẫn test các thay đổi (idempotency + chặn thời gian bắt đầu
quá khứ) trên môi trường **UAT** bằng `curl`. Mọi request tạo đơn phải được **ký
HMAC** theo `PartnerAuthGuard`, nên không thể curl trần — phần dưới có sẵn script ký.

> ⚠️ UAT gọi PVI thật. Mỗi `createOrder` thành công tạo 1 đơn nháp bên PVI
> (chưa thanh toán nên không phát hành GCN/không gửi mail). Dùng thoải mái trên
> UAT, **không** chạy trên prod.

---

## 1. Thông tin môi trường UAT

| | Giá trị |
|---|---|
| Base URL | `http://185.196.21.68:8080` |
| Health check | `GET /health` → `200` |
| Endpoint tạo đơn ô tô | `POST /api/pvi/order` |
| Endpoint tạo đơn xe máy | `POST /api/pvi/moto/order` |
| Tra cứu đơn | `GET /api/pvi/order/:maGiaodich` |
| Admin login | `POST /admin/auth/login` |
| Admin xem log PVI | `GET /admin/api-logs?maGiaodich=...` |

### Credential partner (UAT)

| | Giá trị |
|---|---|
| `x-client-id` | `partner-abc` |
| `x-key-id` | `2d3c48e8-e667-468a-be5e-166906298f89` |
| secret (HMAC key) | `9e07bd6f35eb77d3de9849083215c82de18d79e3c4bc5f061a8127268f73e487` |
| `x-signature-version` | `v1` |

> Secret là chuỗi hex 64 ký tự và được dùng **nguyên văn làm UTF-8 string** làm
> khóa HMAC (KHÔNG decode hex ra bytes).

---

## 2. Cơ chế ký request

Mỗi request cần 6 header:

```
x-client-id, x-key-id, x-timestamp, x-nonce, x-signature, x-signature-version
```

- `x-timestamp`: epoch **giây** (lệch tối đa ±300s so với server).
- `x-nonce`: chuỗi ngẫu nhiên duy nhất mỗi request (chống replay).
- `x-signature` = `HMAC_SHA256_hex(secret, canonical)`, với:

```
canonical = METHOD + "\n" + pathWithQuery + "\n" + timestamp + "\n" + nonce + "\n" + sha256hex(rawBody)
```

`pathWithQuery` là path (vd `/api/pvi/order`), `rawBody` là **đúng chuỗi JSON**
bạn gửi (sha256 phải tính trên byte gửi đi y hệt).

---

## 3. Script ký + gọi (copy-paste chạy ngay)

Lưu thành `uat.sh`, cần `bash`, `curl`, `openssl`.

```bash
#!/usr/bin/env bash
set -u
BASE="http://185.196.21.68:8080"
CLIENT_ID="partner-abc"
KEY_ID="2d3c48e8-e667-468a-be5e-166906298f89"
SECRET="9e07bd6f35eb77d3de9849083215c82de18d79e3c4bc5f061a8127268f73e487"
SIG_VER="v1"

sha256hex() { openssl dgst -sha256 -hex | sed 's/^.*= //'; }
hmac() { printf '%s' "$1" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.*= //'; }

# call METHOD PATH BODY  -> in HTTP status, body lưu /tmp/uat_body
call() {
  local method="$1" path="$2" body="$3" ts nonce bodyhash canonical sig
  ts=$(date +%s)
  nonce="n-$(date +%s%N)-$RANDOM"
  bodyhash=$(printf '%s' "$body" | sha256hex)
  canonical=$(printf '%s\n%s\n%s\n%s\n%s' "$method" "$path" "$ts" "$nonce" "$bodyhash")
  sig=$(hmac "$canonical")
  curl -s -o /tmp/uat_body -w "%{http_code}\n" -X "$method" "$BASE$path" \
    -H "content-type: application/json" \
    -H "x-client-id: $CLIENT_ID" -H "x-key-id: $KEY_ID" \
    -H "x-timestamp: $ts" -H "x-nonce: $nonce" \
    -H "x-signature: $sig" -H "x-signature-version: $SIG_VER" \
    --data "$body"
  cat /tmp/uat_body; echo
}
```

> ⚠️ Kiểu dữ liệu phải đúng: `ChoNgoi`, `TrongTai` là **number string** (`"4"`,
> không phải `4`); `NamSD`, `NamSX`, `nam_sanxuat` là **string**; `MaMucDichSD`
> là `"1"`/`"2"`/`"3"`. Sai kiểu → 400 (do `class-validator`), không phải lỗi auth.

---

## 4. Payload mẫu

### Ô tô — hợp lệ (thời gian tương lai)
```bash
AUTO='{"idempotencyKey":"uat-auto-'"$(date +%s)"'","TenKH":"Nguyen Van A","DiaChiKH":"123 Le Loi","TenChuXe":"Nguyen Van A","DiaChiChuXe":"123 Le Loi","NgayDau":"01/12/2026","NgayCuoi":"01/12/2027","GioDau":"08:00","GioCuoi":"23:59","EmailKH":"uat@example.com","LoaiXe":"1","ChoNgoi":"4","TenLoaiXe":"Xe con","TrongTai":"0","PhiBHTNDSBB":"500000","NamSD":"2020","BienKiemSoat":"51A-99999","HieuXe":"Toyota","DongXe":"Vios","NamSX":"2020","DienThoai":"0901234567","SoKhung":"KH-UAT-001","SoMay":"MY-UAT-001","TongPhi":"500000","MaMucDichSD":"1"}'
```

### Xe máy — hợp lệ (ngay_dau gộp "dd/MM/yyyy HH:mm")
```bash
MOTO='{"idempotencyKey":"uat-moto-'"$(date +%s)"'","ten_nguoimua_bh":"Nguyen Van A","diachi_nguoimua_bh":"123 Le Loi","ngay_dau":"01/12/2026 00:00","ngay_cuoi":"01/12/2027 00:00","bien_kiemsoat":"60B1-99999","loai_xe":"1","nhan_hieu":"Honda","nam_sanxuat":"2020","ten_chuxe":"Nguyen Van A","email":"uat@example.com","so_dienthoai":"0901234567","dia_chi":"123 Le Loi"}'
```

---

## 5. Các ca test & kết quả mong đợi

> Chạy `source uat.sh` trước, rồi từng lệnh dưới.

### Ca 0 — Health
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://185.196.21.68:8080/health   # 200
```

### Ca 1 — Thiếu `idempotencyKey` → 400 (ô tô & xe máy)
```bash
# bỏ field idempotencyKey khỏi $AUTO / $MOTO rồi gọi:
call POST /api/pvi/order "$(echo "$AUTO" | sed 's/"idempotencyKey":"[^"]*",//')"        # 400
call POST /api/pvi/moto/order "$(echo "$MOTO" | sed 's/"idempotencyKey":"[^"]*",//')"   # 400
```
Body chứa: `"idempotencyKey should not be empty"` (hoặc tương đương).

### Ca 2 — Thời gian bắt đầu quá khứ → 400
```bash
# ô tô: NgayDau quá khứ
call POST /api/pvi/order "$(echo "$AUTO" | sed 's#"NgayDau":"[^"]*"#"NgayDau":"01/01/2020"#')"   # 400
# xe máy: ngay_dau quá khứ
call POST /api/pvi/moto/order "$(echo "$MOTO" | sed 's#"ngay_dau":"[^"]*"#"ngay_dau":"01/01/2020 00:00"#')"  # 400
```
Message: `Thời gian bắt đầu (NgayDau + GioDau) không được ở quá khứ` /
`Thời gian bắt đầu (ngay_dau) không được ở quá khứ`.

> Lưu ý: kiểm **chính xác đến phút** theo giờ VN (UTC+7). Riêng khi `GioDau="00:00"`
> hệ thống tự round-up lên đầu giờ kế tiếp nếu là **hôm nay** (xem
> `resolveGioDau`), nên `00:00` hôm nay KHÔNG bị coi là quá khứ một cách cứng nhắc.

### Ca 3 — Auth chữ ký sai → 401
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://185.196.21.68:8080/api/pvi/order \
  -H "content-type: application/json" -H "x-client-id: partner-abc" \
  -H "x-key-id: 2d3c48e8-e667-468a-be5e-166906298f89" \
  -H "x-timestamp: $(date +%s)" -H "x-nonce: bad-$RANDOM" \
  -H "x-signature: deadbeef" -H "x-signature-version: v1" \
  --data "$AUTO"    # 401
```

### Ca 4 — **Idempotency**: gửi 2 lần CÙNG key → cùng `maGiaodich`, không tạo đơn mới
```bash
IDEM="uat-idem-$(date +%s)-$RANDOM"
B=$(echo "$AUTO" | sed 's/"idempotencyKey":"[^"]*"/"idempotencyKey":"'"$IDEM"'"/')
echo "== lần 1 =="; call POST /api/pvi/order "$B"
echo "== lần 2 =="; call POST /api/pvi/order "$B"
```
✅ ĐẠT khi: cả 2 lần trả **cùng `maGiaodich` và cùng `Pr_key`**. Đây là bằng chứng
gateway KHÔNG gọi PVI lần 2 (chống tạo trùng đơn / chống nhiều GCN-mail).

---

## 6. Kiểm chứng bằng audit log (admin)

Đếm số lần gateway gọi PVI cho 1 đơn — chứng minh idempotency ở tầng PVI.

```bash
# Login lấy JWT
TOKEN=$(curl -s -X POST http://185.196.21.68:8080/admin/auth/login \
  -H "content-type: application/json" \
  --data '{"username":"<ADMIN_USERNAME>","password":"<ADMIN_PASSWORD>"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

# Xem log PVI của 1 maGiaodich
curl -s "http://185.196.21.68:8080/admin/api-logs?maGiaodich=<MA_GIAODICH>" \
  -H "authorization: Bearer $TOKEN"
```

Kỳ vọng cho 1 đơn idempotent (POST 2 lần cùng key):
- Đúng **1** log endpoint `TaoDon_Auto` / `TaoDon_XeMay` (tạo đơn) → gateway chỉ
  gọi PVI 1 lần.
- Các log `GetPolicyNumber` là reconcile/tra cứu (đọc), không tạo đơn.

> Field nhạy cảm (tên, email, SĐT, biển số…) bị **mask `***`** trong audit log.

---

## 7. Bảng tóm tắt kỳ vọng

| Ca | Endpoint | Thay đổi payload | HTTP | Ý nghĩa |
|----|----------|------------------|------|---------|
| 0 | `/health` | — | 200 | server sống |
| 1a | `/api/pvi/order` | bỏ `idempotencyKey` | 400 | key bắt buộc |
| 1b | `/api/pvi/moto/order` | bỏ `idempotencyKey` | 400 | key bắt buộc |
| 2a | `/api/pvi/order` | `NgayDau` quá khứ | 400 | chặn quá khứ |
| 2b | `/api/pvi/moto/order` | `ngay_dau` quá khứ | 400 | chặn quá khứ |
| 3 | bất kỳ | chữ ký sai | 401 | auth còn nguyên |
| 4 | `/api/pvi/order` | 2× cùng `idempotencyKey` | 201 + cùng `maGiaodich`/`Pr_key` | idempotent |
```
