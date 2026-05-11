import { Injectable } from '@nestjs/common';
import { PviConfig } from '../config/pvi.config';
import { md5, timingSafeEqual } from '../common/crypto/md5.util';

@Injectable()
export class SignService {
  constructor(private readonly cfg: PviConfig) {}

  // Sign = MD5(Key + ma_trongtai + so_cho)
  forGetFee(p: { ma_trongtai: string; so_cho: number }): string {
    return md5(this.cfg.key + p.ma_trongtai + String(p.so_cho));
  }

  // Sign = MD5(Key + ma_giaodich)
  forCreateOrder(p: { ma_giaodich: string }): string {
    return md5(this.cfg.key + p.ma_giaodich);
  }

  // Sign = MD5(Key + ten_dmuc + ma_user + ma_donvi + giatri_chon)
  forCategory(p: { ten_dmuc: string; ma_user: string; ma_donvi: string; giatri_chon: string }): string {
    return md5(this.cfg.key + p.ten_dmuc + p.ma_user + p.ma_donvi + p.giatri_chon);
  }

  // Sign = MD5(Key + SoChoNgoi + TrongTai + Ma_MDSD + LoaiHinh)
  forGetVehicleType(p: { SoChoNgoi: number; TrongTai: number; Ma_MDSD: string; LoaiHinh: string }): string {
    return md5(this.cfg.key + String(p.SoChoNgoi) + String(p.TrongTai) + p.Ma_MDSD + p.LoaiHinh);
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
