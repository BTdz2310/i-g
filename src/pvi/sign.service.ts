import { Injectable } from '@nestjs/common';
import { PviConfig } from '../config/pvi.config';
import { md5, timingSafeEqual } from '../common/crypto/md5.util';

/**
 * Chữ ký request gọi sang PVI.
 *
 * trong đặc tả API của PVI (API_Document_South-AZ_Plus): mọi request phải kèm
 * Sign = MD5(Key + tham_số...). Không thể đổi sang SHA-256 vì sẽ không khớp
 * chữ ý PVI verify ở phía họ. MD5 ở đây dùng cho mục đích chữ ký theo hợp đồng
 * tích hợp (HMAC-like với shared Key), KHÔNG dùng để hash mật khẩu hay dữ liệu
 * nhạy cảm. Hotspot này có thể đánh dấu "Safe — required by 3rd-party spec".
 */
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
  forCategory(p: {
    ten_dmuc: string;
    ma_user: string;
    ma_donvi: string;
    giatri_chon: string;
  }): string {
    return md5(
      this.cfg.key + p.ten_dmuc + p.ma_user + p.ma_donvi + p.giatri_chon,
    );
  }

  // Sign = MD5(Key + SoChoNgoi + TrongTai + Ma_MDSD + LoaiHinh)
  forGetVehicleType(p: {
    SoChoNgoi: number;
    TrongTai: number;
    Ma_MDSD: string;
    LoaiHinh: string;
  }): string {
    return md5(
      this.cfg.key +
        String(p.SoChoNgoi) +
        String(p.TrongTai) +
        p.Ma_MDSD +
        p.LoaiHinh,
    );
  }

  // Sign = MD5(Key + RequestId)
  forGetPolicy(p: { RequestId: string }): string {
    return md5(this.cfg.key + p.RequestId);
  }

  // Sign = MD5(Key + ngay_dau + ngay_cuoi + loai_xe)
  forGetMotoFee(p: {
    ngay_dau: string;
    ngay_cuoi: string;
    loai_xe: string;
  }): string {
    return md5(this.cfg.key + p.ngay_dau + p.ngay_cuoi + p.loai_xe);
  }

  // Sign = MD5(Key + bien_kiemsoat + email + ma_user + so_dienthoai + nhan_hieu + loai_xe + nam_sanxuat)
  // ma_user cố định '' (verified với PVI dev server)
  forCreateMotoOrder(p: {
    bien_kiemsoat: string;
    email: string;
    so_dienthoai: string;
    nhan_hieu: string;
    loai_xe: string;
    nam_sanxuat: string;
  }): string {
    return md5(
      this.cfg.key +
        p.bien_kiemsoat +
        p.email +
        '' +
        p.so_dienthoai +
        p.nhan_hieu +
        p.loai_xe +
        p.nam_sanxuat,
    );
  }

  // Verify callback: Sign = MD5(Key + RequestId + PolicyNumber + URL)
  verifyCallback(p: {
    RequestId: string;
    PolicyNumber: string;
    URL: string;
    Sign: string;
  }): boolean {
    const expected = md5(this.cfg.key + p.RequestId + p.PolicyNumber + p.URL);
    return timingSafeEqual(expected, p.Sign);
  }
}
