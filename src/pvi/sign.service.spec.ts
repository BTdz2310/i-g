import { SignService } from './sign.service';

const cfg = { key: 'test-pvi-key', cpId: 'cp001', baseUrl: '', endpoints: {}, timeoutMs: 5000 } as any;

describe('SignService', () => {
  let svc: SignService;

  beforeEach(() => {
    svc = new SignService(cfg);
  });

  describe('forGetFee', () => {
    it('returns 32-char hex string', () => {
      expect(svc.forGetFee({ ma_trongtai: 'TT01', so_cho: 5 })).toHaveLength(32);
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
    const p = { ten_dmuc: 'cat', ma_user: 'u1', ma_donvi: 'd1', giatri_chon: 'g1' };
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

  describe('verifyCallback', () => {
    it('returns true for correct signature', () => {
      const md5Lib = require('md5');
      const key = cfg.key;
      const RequestId = 'REQ-001';
      const PolicyNumber = 'POL-123';
      const URL = 'https://callback.example.com/notify';
      const Sign = md5Lib(key + RequestId + PolicyNumber + URL);

      expect(svc.verifyCallback({ RequestId, PolicyNumber, URL, Sign })).toBe(true);
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
      const md5Lib = require('md5');
      const Sign = md5Lib(cfg.key + 'REQ-001' + 'POL-123' + 'https://real.com');
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
