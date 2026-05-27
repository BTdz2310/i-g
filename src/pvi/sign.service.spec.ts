// eslint-disable-next-line @typescript-eslint/no-require-imports
import md5 = require('md5');
import { SignService } from './sign.service';
import { PviConfig, PviEndpoints } from '../config/pvi.config';

const ep: PviEndpoints = {
  getFee: '',
  createOrder: '',
  category: '',
  getVehicleType: '',
  getPolicy: '',
  getFeeMoto: '',
  createOrderMoto: '',
};
const cfg = {
  key: 'test-pvi-key',
  cpId: 'cp001',
  baseUrl: '',
  ep,
  timeoutMs: 5000,
} as PviConfig;

describe('SignService', () => {
  let svc: SignService;

  beforeEach(() => {
    svc = new SignService(cfg);
  });

  describe('forGetFee', () => {
    it('returns 32-char hex string', () => {
      expect(svc.forGetFee({ ma_trongtai: 'TT01', so_cho: 5 })).toHaveLength(
        32,
      );
    });

    it('is deterministic', () => {
      const p = { ma_trongtai: 'TT01', so_cho: 5 };
      expect(svc.forGetFee(p)).toBe(svc.forGetFee(p));
    });

    it('changes with different ma_trongtai', () => {
      expect(svc.forGetFee({ ma_trongtai: 'A', so_cho: 5 })).not.toBe(
        svc.forGetFee({ ma_trongtai: 'B', so_cho: 5 }),
      );
    });
  });

  describe('forCreateOrder', () => {
    it('returns 32-char hex', () => {
      expect(svc.forCreateOrder({ ma_giaodich: 'GD-001' })).toHaveLength(32);
    });

    it('changes with different ma_giaodich', () => {
      expect(svc.forCreateOrder({ ma_giaodich: 'GD-001' })).not.toBe(
        svc.forCreateOrder({ ma_giaodich: 'GD-002' }),
      );
    });
  });

  describe('forCategory', () => {
    const p = {
      ten_dmuc: 'cat',
      ma_user: 'u1',
      ma_donvi: 'd1',
      giatri_chon: 'g1',
    };
    it('returns 32-char hex', () => {
      expect(svc.forCategory(p)).toHaveLength(32);
    });
    it('is deterministic', () => {
      expect(svc.forCategory(p)).toBe(svc.forCategory(p));
    });
  });

  describe('forGetVehicleType', () => {
    const p = { SoChoNgoi: 5, TrongTai: 2, Ma_MDSD: 'M01', LoaiHinh: 'L1' };
    it('returns 32-char hex', () => {
      expect(svc.forGetVehicleType(p)).toHaveLength(32);
    });
  });

  describe('forGetPolicy', () => {
    it('returns 32-char hex', () => {
      expect(svc.forGetPolicy({ RequestId: 'req-001' })).toHaveLength(32);
    });
  });

  describe('forGetMotoFee', () => {
    const p = { ngay_dau: '2025-01-01', ngay_cuoi: '2025-12-31', loai_xe: '1' };
    it('returns 32-char hex', () => {
      expect(svc.forGetMotoFee(p)).toHaveLength(32);
    });
    it('is deterministic', () => {
      expect(svc.forGetMotoFee(p)).toBe(svc.forGetMotoFee(p));
    });
    it('changes with different loai_xe', () => {
      expect(svc.forGetMotoFee({ ...p, loai_xe: '1' })).not.toBe(
        svc.forGetMotoFee({ ...p, loai_xe: '2' }),
      );
    });
  });

  describe('forCreateMotoOrder', () => {
    const p = {
      bien_kiemsoat: '51A-12345',
      email: 'a@example.com',
      so_dienthoai: '0901234567',
      nhan_hieu: 'Honda',
      loai_xe: '1',
      nam_sanxuat: '2020',
    };
    it('returns 32-char hex', () => {
      expect(svc.forCreateMotoOrder(p)).toHaveLength(32);
    });
    it('is deterministic', () => {
      expect(svc.forCreateMotoOrder(p)).toBe(svc.forCreateMotoOrder(p));
    });
    it('changes with different bien_kiemsoat', () => {
      expect(
        svc.forCreateMotoOrder({ ...p, bien_kiemsoat: '51A-11111' }),
      ).not.toBe(svc.forCreateMotoOrder({ ...p, bien_kiemsoat: '51A-99999' }));
    });
  });

  describe('verifyCallback', () => {
    it('returns true for correct signature', () => {
      const key = cfg.key;
      const RequestId = 'REQ-001';
      const PolicyNumber = 'POL-123';
      const URL = 'https://callback.example.com/notify';
      const Sign = md5(key + RequestId + PolicyNumber + URL);

      expect(svc.verifyCallback({ RequestId, PolicyNumber, URL, Sign })).toBe(
        true,
      );
    });

    it('returns false for wrong signature', () => {
      expect(
        svc.verifyCallback({
          RequestId: 'REQ-001',
          PolicyNumber: 'POL-123',
          URL: 'https://callback.example.com',
          Sign: 'wrongsignature123456789012345678',
        }),
      ).toBe(false);
    });

    it('returns false for tampered data', () => {
      const Sign = md5(cfg.key + 'REQ-001' + 'POL-123' + 'https://real.com');
      expect(
        svc.verifyCallback({
          RequestId: 'REQ-001',
          PolicyNumber: 'POL-456',
          URL: 'https://real.com',
          Sign,
        }),
      ).toBe(false);
    });
  });
});
