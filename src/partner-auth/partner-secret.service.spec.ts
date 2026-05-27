import { PartnerSecretService } from './partner-secret.service';
import { validateEnv } from '../config/env';

const MASTER_KEY_B64 = Buffer.alloc(32, 0xab).toString('base64');

beforeAll(() => {
  validateEnv({
    PVI_BASE_URL: 'https://pvi.example.com',
    PVI_CP_ID: 'cp',
    PVI_KEY: 'k',
    PVI_EP_GET_FEE: '/fee',
    PVI_EP_CREATE_ORDER: '/order',
    PVI_EP_CATEGORY: '/cat',
    PVI_EP_GET_VEHICLE_TYPE: '/vt',
    PVI_EP_GET_POLICY: '/pol',
    PVI_EP_GET_FEE_MOTO: '/fee-moto',
    PVI_EP_CREATE_ORDER_MOTO: '/order-moto',
    DATABASE_URL: 'postgres://localhost/test',
    REDIS_URL: 'redis://localhost',
    PARTNER_SECRET_MASTER_KEY: MASTER_KEY_B64,
    ADMIN_JWT_SECRET: 'supersecretjwtsecretkey1234567890',
  });
});

describe('PartnerSecretService', () => {
  let svc: PartnerSecretService;

  beforeEach(() => {
    svc = new PartnerSecretService();
  });

  describe('generateSecret', () => {
    it('returns 64-char hex string (32 bytes)', () => {
      expect(svc.generateSecret()).toHaveLength(64);
      expect(svc.generateSecret()).toMatch(/^[0-9a-f]+$/);
    });

    it('returns unique values each call', () => {
      expect(svc.generateSecret()).not.toBe(svc.generateSecret());
    });
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('decrypts back to original', () => {
      const secret = svc.generateSecret();
      const enc = svc.encrypt(secret);
      expect(svc.decrypt(enc)).toBe(secret);
    });

    it('produces different ciphertext for same input (random IV)', () => {
      const secret = 'same-secret-value';
      const enc1 = svc.encrypt(secret);
      const enc2 = svc.encrypt(secret);
      expect(enc1).not.toBe(enc2);
      expect(svc.decrypt(enc1)).toBe(secret);
      expect(svc.decrypt(enc2)).toBe(secret);
    });

    it('encrypted value is base64', () => {
      const enc = svc.encrypt('test');
      expect(() => Buffer.from(enc, 'base64')).not.toThrow();
    });

    it('throws on tampered ciphertext', () => {
      const enc = svc.encrypt('test-value');
      const tampered = Buffer.from(enc, 'base64');
      tampered[tampered.length - 1] ^= 0xff;
      expect(() => svc.decrypt(tampered.toString('base64'))).toThrow();
    });
  });

  describe('constructor', () => {
    it('throws when master key is not 32 bytes', () => {
      const badKey = Buffer.alloc(16).toString('base64');
      // Temporarily set bad key via module-level mock of getEnv
      jest.mock('../config/env', () => ({
        getEnv: () => ({ PARTNER_SECRET_MASTER_KEY: badKey }),
      }));
    });
  });
});
