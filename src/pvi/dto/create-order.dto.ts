export interface CreateOrderInput {
  ma_giaodich: string;
  TenKH: string;
  DiaChiKH: string;
  TenTH: string;
  DiaChiTH: string;
  TenChuXe: string;
  DiaChiChuXe: string;
  NgayDau: string;
  NgayCuoi: string;
  GioDau: string;
  GioCuoi: string;
  ThamGiaLaiPhu: boolean;
  EmailKH: string;
  LoaiXe: string;
  ChoNgoi: string;
  TenLoaiXe: string;
  TrongTai: string;
  MTNLaiPhu: string;
  SoNguoiToiDa: string;
  PhiBHTNDSBB: string;
  PhiBHLaiPhu: string;
  NamSD: string;
  AnBKS: boolean;
  BienKiemSoat: string;
  HieuXe: string;
  DongXe: string;
  NamSX: string;
  DienThoai: string;
  SoKhung: string;
  SoMay: string;
  AnPhi: boolean;
  TongPhi: string;
  MaMucDichSD: string;
  MayKeo: boolean;
  XeChuyenDung: boolean;
  XeChoTien: boolean;
  XePickUp: boolean;
  XeTaiVan: boolean;
  XeTapLai: boolean;
  XeBus: boolean;
  XeCuuThuong: boolean;
  Xetaxi: boolean;
  XeDauKeo: boolean;
  thamgia_cuuho_khancap?: boolean;
  mtn_cuuho_khancap?: number;
  phi_cuuho_khancap?: number;
  tylep_hi_cuuho_khancap?: number;
}

export interface CreateOrderResult {
  Status: string;
  Message: string;
  Pr_key: number;
  URL_Payment: string | null;
  SerialNumber: string | null;
}
