export interface CategoryInput {
  parent_value: string;
  ten_dmuc: string;
  ma_user: string;
  ma_donvi: string;
  giatri_chon: string;
}

export interface CategoryItem {
  Value: string;
  Text: string;
}

export interface CategoryResult {
  Status: string;
  Message: string;
  Data: CategoryItem[];
}
