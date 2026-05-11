# Luồng mua bảo hiểm TNDS xe máy

Base URL: `https://<gateway-domain>`

---

## Tổng quan luồng

```
FE                          Gateway                        PVI
 │                              │                            │
 │── 1. GET catalog ───────────▶│── getCategory ────────────▶│
 │◀─ danh sách loại xe máy ─────│◀──────────────────────────│
 │                              │                            │
 │── 2. FE tự tính ngaycuoi ───▶│  (không gọi API)          │
 │                              │                            │
 │  3. Hỏi BH người ngồi trên xe│  (FE hiển thị modal chọn) │
 │                              │                            │
 │── 4. POST /quote ───────────▶│── getTongPhi ─────────────▶│
 │◀─ TotalFee ──────────────────│◀──────────────────────────│
 │                              │                            │
 │── 5. POST /order ───────────▶│── TaoDon ─────────────────▶│
 │◀─ { maGiaodich, paymentUrl }─│◀── { Pr_key, URL_Payment }│
 │                              │                            │
 │── 6. redirect paymentUrl ───▶│  (user thanh toán trên PVI)│
 │                              │                            │
 │── 7. poll GET /order/:id ───▶│                            │
 │◀─ { status: ISSUED, pdfUrl }─│◀── PVI callback ──────────│
```

---

## Bước 1 — Lấy danh sách loại xe máy

```http
POST /api/pvi/catalog
Content-Type: application/json

{
  "ten_dmuc": "LOAIXEMOTOR",
  "parent_value": "1",
  "giatri_chon": ""
}
```

**Response:**
```json
[
  { "Value": "5001", "Text": "Xe mô tô 2 bánh dưới 50cc" },
  { "Value": "5002", "Text": "Xe mô tô 2 bánh từ 50cc đến dưới 175cc" },
  { "Value": "5003", "Text": "Xe mô tô 2 bánh từ 175cc trở lên" }
]
```

> Lưu `Value` để dùng làm `ma_loaixe` ở bước 4 và `LoaiXe` ở bước 5.

---

## Bước 2 — Tính ngày kết thúc (FE tự tính, không gọi API)

Thời hạn được fix cứng 3 lựa chọn. FE tính `ngaycuoi` từ `ngaydau` do người dùng chọn:

| Thời hạn | Cách tính |
|---|---|
| 1 năm | `ngaydau + 1 năm - 1 ngày` |
| 2 năm | `ngaydau + 2 năm - 1 ngày` |
| 3 năm | `ngaydau + 3 năm - 1 ngày` |

**Ví dụ:** `ngaydau = 01/06/2026`, chọn 1 năm → `ngaycuoi = 31/05/2027`

Format ngày: `dd/MM/yyyy`. Giờ cố định: `giodau = "00:00"`, `giocuoi = "23:59"`.

---

## Bước 3 — Hỏi BH trách nhiệm bồi thường người ngồi trên xe (tùy chọn)

FE hiển thị câu hỏi cho người dùng:

> **Bạn có cần thêm bảo hiểm trách nhiệm bồi thường đối với người ngồi trên xe không?**

Nếu có → cho chọn **số tiền bảo hiểm** (mức trách nhiệm):

| Gợi ý mức | Giá trị truyền vào `mtn_laiphu` |
|---|---|
| 3.000.000 đ/người | `3000000` |
| 5.000.000 đ/người | `5000000` |
| 10.000.000 đ/người | `10000000` |

> Các mức cụ thể do PVI quy định — xác nhận lại với PVI để lấy danh sách chính xác.

Lưu 2 giá trị này để truyền vào bước 4 (tính phí) và bước 5 (tạo đơn):

| Người dùng chọn | `thamgia_laiphu` | `mtn_laiphu` |
|---|---|---|
| Không tham gia | `false` | `0` |
| Có tham gia | `true` | giá trị đã chọn |

---

## Bước 4 — Tính phí bảo hiểm

```http
POST /api/pvi/quote
Content-Type: application/json

{
  "ma_trongtai": "",
  "so_cho": 2,
  "ma_mdsd": "1",
  "ma_loaixe": "5002",
  "giodau": "00:00",
  "giocuoi": "23:59",
  "ngaydau": "01/06/2026",
  "ngaycuoi": "31/05/2027",
  "thamgia_tndsbb": true,

  "thamgia_laiphu": true,
  "mtn_laiphu": 5000000,
  "so_nguoi": 1,
  "philpx_nhap": 0,

  "MayKeo": false,
  "XeChuyenDung": false,
  "XeChoTien": false,
  "XePickUp": false,
  "XeTaiVan": false,
  "XeTapLai": false,
  "XeBus": false,
  "XeCuuThuong": false,
  "Xetaxi": false,
  "XeDauKeo": false
}
```

**Các field liên quan BH người ngồi trên xe:**

| Field | Ý nghĩa |
|---|---|
| `thamgia_laiphu` | `true` nếu tham gia BH người ngồi trên xe |
| `mtn_laiphu` | Số tiền bảo hiểm (VND) — mức trách nhiệm người chọn ở bước 3 |
| `so_nguoi` | Số người được bảo hiểm (thường = 1 cho xe máy) |
| `philpx_nhap` | Phí nhập tay — để `0`, gateway/PVI tự tính |

**Response:**
```json
{
  "Status": "00",
  "Message": "Thanh cong",
  "TotalFee": "88000",
  "phi_tndsbb": "66000",
  "phi_lpx": "22000",
  "ma_loaixe": "5002"
}
```

| Field | Ý nghĩa |
|---|---|
| `phi_tndsbb` | Phí TNDS bắt buộc — dùng làm `PhiBHTNDSBB` ở bước 5 |
| `phi_lpx` | Phí BH người ngồi trên xe — dùng làm `PhiBHLaiPhu` ở bước 5 |
| `TotalFee` | Tổng phí = `phi_tndsbb + phi_lpx` — dùng làm `TongPhi` ở bước 5 |

---

## Bước 5 — Tạo đơn bảo hiểm

Gọi ngay sau khi người dùng xác nhận thông tin. Gateway tự sinh `maGiaodich` (UUID) — **mỗi lần gọi tạo 1 đơn mới, không retry với cùng body nếu đã có `maGiaodich`**.

```http
POST /api/pvi/order
Content-Type: application/json

{
  "TenKH": "Nguyễn Văn A",
  "DiaChiKH": "123 Lê Lợi, Q.1, TP.HCM",
  "TenChuXe": "Nguyễn Văn A",
  "DiaChiChuXe": "123 Lê Lợi, Q.1, TP.HCM",
  "NgayDau": "01/06/2026",
  "NgayCuoi": "31/05/2027",
  "GioDau": "00:00",
  "GioCuoi": "23:59",
  "EmailKH": "khachhang@email.com",
  "DienThoai": "0912345678",
  "LoaiXe": "5002",
  "TenLoaiXe": "Xe mô tô 2 bánh từ 50cc đến dưới 175cc",
  "ChoNgoi": "2",
  "TrongTai": "0",
  "HieuXe": "",
  "DongXe": "",
  "BienKiemSoat": "51B1-12345",
  "SoKhung": "FRAME123456789",
  "SoMay": "ENG123456",
  "NamSX": "01/2022",
  "NamSD": "01/2022",
  "MaMucDichSD": "1",

  "PhiBHTNDSBB": "66000",
  "ThamGiaLaiPhu": true,
  "MTNLaiPhu": "5000000",
  "SoNguoiToiDa": "1",
  "PhiBHLaiPhu": "22000",
  "TongPhi": "88000",

  "AnBKS": false,
  "AnPhi": false,
  "productKind": "MOTO"
}
```

**Các field liên quan BH người ngồi trên xe:**

| Field | Lấy từ đâu |
|---|---|
| `ThamGiaLaiPhu` | Người dùng chọn ở bước 3 |
| `MTNLaiPhu` | Mức trách nhiệm người dùng chọn ở bước 3 (dạng string) |
| `SoNguoiToiDa` | Số người bảo hiểm (dạng string) |
| `PhiBHLaiPhu` | `phi_lpx` từ response bước 4 |
| `PhiBHTNDSBB` | `phi_tndsbb` từ response bước 4 |
| `TongPhi` | `TotalFee` từ response bước 4 |

**Response `201`:**
```json
{
  "maGiaodich": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "Pr_key": 123456,
  "paymentUrl": "https://payment.pvi.com.vn/pay?token=xxxxx",
  "serialNumber": null
}
```

| Field | Ý nghĩa |
|---|---|
| `maGiaodich` | UUID để track đơn — **lưu lại ngay** |
| `paymentUrl` | URL redirect người dùng đến trang thanh toán PVI |
| `serialNumber` | Serial nháp — thường `null` ở bước này |

---

## Bước 6 — Redirect thanh toán

```javascript
window.location.href = paymentUrl
```

Người dùng thanh toán trực tiếp trên trang PVI. Sau khi thanh toán, PVI cấp GCN và gọi callback về gateway.

---

## Bước 7 — Lấy kết quả / GCN

Poll sau khi người dùng redirect về từ trang thanh toán PVI:

```http
GET /api/pvi/order/{maGiaodich}
```

**Response:**
```json
{
  "maGiaodich": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "ISSUED",
  "paymentUrl": "https://payment.pvi.com.vn/pay?token=xxxxx",
  "policyNumber": "TNDS-MOTOR-2026-001234",
  "serialNumber": "SN-2026-001234",
  "pdfUrl": "https://pvi.com.vn/gcn/abc123.pdf"
}
```

### Trạng thái đơn (`status`)

| Status | Ý nghĩa | Hành động |
|---|---|---|
| `SUBMITTING` | Đang gửi sang PVI | Chờ |
| `SUBMITTED_OK` | PVI nhận đơn, chờ cấp GCN | Poll lại sau 5-10 giây |
| `SUBMITTED_FAIL` | Lỗi gửi đơn | Hiển thị lỗi, cho phép thử lại |
| `ISSUED` | GCN đã được cấp | Lấy `pdfUrl` để hiển thị/download |
| `CALLBACK_TIMEOUT` | PVI không callback sau nhiều lần retry | Liên hệ hỗ trợ |

### Gợi ý polling strategy

```javascript
async function pollPolicy(maGiaodich, maxRetries = 12, intervalMs = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(`/api/pvi/order/${maGiaodich}`);
    const data = await res.json();

    if (data.status === 'ISSUED') return data;
    if (data.status === 'SUBMITTED_FAIL') throw new Error('Tạo đơn thất bại');

    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Timeout chờ kết quả');
}
```

> Thông thường PVI cấp GCN trong vòng **10-30 giây** sau thanh toán.

---

## Lưu ý quan trọng

- Format ngày: `dd/MM/yyyy` — format giờ: `HH:mm`
- `productKind: "MOTO"` bắt buộc truyền cho xe máy
- `MaMucDichSD`: `"1"` = không KDVT, `"2"` = KDVT, `"3"` = chở hàng
- `maGiaodich` phải lưu ngay sau bước 5 — dùng để poll và tra cứu sau này
- Không gọi lại `POST /order` nếu đã có `maGiaodich` — mỗi lần gọi tạo 1 đơn mới
