export interface VehicleTypeInput {
  SoChoNgoi: number;
  Ma_MDSD: string;
  LoaiHinh: string;
  TrongTai: number;
}

export interface VehicleTypeItem {
  Value: string;
  Text: string;
}

export interface VehicleTypeResult {
  Status: string;
  Message: string;
  Data: VehicleTypeItem[];
}
