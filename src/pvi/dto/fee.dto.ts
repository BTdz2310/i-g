export interface FeeInput {
  ma_trongtai: string;
  so_cho: number;
  ma_mdsd: string;
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
  giodau: string;
  giocuoi: string;
  ngaydau: string;
  ngaycuoi: string;
  mtn_laiphu: number;
  so_nguoi: number;
  thamgia_laiphu: boolean;
  philpx_nhap: number;
  thamgia_tndsbb: boolean;
  ma_loaixe: string;
}

export interface FeeResult {
  Status: string;
  Message: string;
  TotalFee: string;
  phi_tndsbb: string;
  ma_loaixe: string;
  phi_lpx: string;
}
