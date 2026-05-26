export interface FeeMotoInput {
  ngay_dau: string;
  ngay_cuoi: string;
  loai_xe: string;
  thamgia_laiphu: boolean;
  muc_trachnhiem_laiphu: number;
  so_nguoi_tgia_laiphu: number;
  tyle_phi_laiphu: number;
}

export interface FeeMotoResult {
  Status: string;
  Message: string;
  phi_moto: number;
  phi_laiphu: number;
  TotalFee: number;
}
