export interface CreateMotoOrderInput {
  ma_giaodich: string;
  ten_nguoimua_bh: string;
  diachi_nguoimua_bh: string;
  ngay_dau: string;
  ngay_cuoi: string;
  bien_kiemsoat: string;
  so_may: string;
  so_khung: string;
  loai_xe: string;
  nhan_hieu: string;
  nam_sanxuat: string;
  ten_chuxe: string;
  email: string;
  so_dienthoai: string;
  dia_chi: string;
  thamgia_laiphu: boolean;
  muc_trachnhiem_laiphu: number;
  so_nguoi_tgia_laiphu: number;
  an_bien_ks: boolean;
}

export interface CreateMotoOrderResult {
  Status: string;
  Message: string;
  Pr_key: number;
  URL_Payment?: string | null;
  SerialNumber?: string | null;
}
