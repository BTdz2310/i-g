import { AdminJwtService } from './jwt.service';
import { validateEnv } from '../config/env';

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
    DATABASE_URL: 'postgres://localhost/test',
    REDIS_URL: 'redis://localhost',
    PARTNER_SECRET_MASTER_KEY: Buffer.alloc(32, 0x01).toString('base64'),
    ADMIN_JWT_SECRET: 'supersecretjwtsecretkey1234567890',
    ADMIN_JWT_EXPIRES_IN: '12h',
  });
});

describe('AdminJwtService', () => {
  let svc: AdminJwtService;

  beforeEach(() => {
    svc = new AdminJwtService();
  });

  describe('sign', () => {
    it('returns a token string', () => {
      const result = svc.sign({ adminId: 'uuid-1', username: 'admin' });
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // JWT format
    });

    it('returns expiresIn matching env', () => {
      const result = svc.sign({ adminId: 'uuid-1', username: 'admin' });
      expect(result.expiresIn).toBe('12h');
    });
  });

  describe('verify', () => {
    it('verifies and returns payload', () => {
      const { token } = svc.sign({ adminId: 'uuid-99', username: 'test-user' });
      const payload = svc.verify(token);
      expect(payload.adminId).toBe('uuid-99');
      expect(payload.username).toBe('test-user');
    });

    it('throws on invalid token', () => {
      expect(() => svc.verify('invalid.token.here')).toThrow();
    });

    it('throws on tampered payload', () => {
      const { token } = svc.sign({ adminId: 'uuid-1', username: 'admin' });
      const [header, , sig] = token.split('.');
      const fakePayload = Buffer.from(
        JSON.stringify({ adminId: 'hacker', username: 'evil' }),
      ).toString('base64url');
      expect(() => svc.verify(`${header}.${fakePayload}.${sig}`)).toThrow();
    });
  });
});
