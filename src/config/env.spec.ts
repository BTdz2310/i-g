import { validateEnv, getEnv } from './env';

const VALID_ENV = {
  PVI_BASE_URL: 'https://pvi.example.com',
  PVI_CP_ID: 'cp001',
  PVI_KEY: 'secret-key',
  PVI_EP_GET_FEE: '/fee',
  PVI_EP_CREATE_ORDER: '/order',
  PVI_EP_CATEGORY: '/category',
  PVI_EP_GET_VEHICLE_TYPE: '/vehicle-type',
  PVI_EP_GET_POLICY: '/policy',
  DATABASE_URL: 'postgres://localhost/test',
  REDIS_URL: 'redis://localhost:6379',
  PARTNER_SECRET_MASTER_KEY: 'a'.repeat(20),
  ADMIN_JWT_SECRET: 'supersecretjwtsecretkey1234567890',
};

describe('validateEnv', () => {
  it('accepts valid env and returns parsed object', () => {
    const env = validateEnv(VALID_ENV);
    expect(env.PVI_BASE_URL).toBe('https://pvi.example.com');
    expect(env.PORT).toBe(3000); // default
    expect(env.CATEGORY_CACHE_TTL_SEC).toBe(21600); // default
    expect(env.RECONCILE_INTERVAL_MIN).toBe(5);
    expect(env.PARTNER_AUTH_SKEW_SECONDS).toBe(300);
    expect(env.ADMIN_JWT_EXPIRES_IN).toBe('12h');
  });

  it('coerces PORT from string', () => {
    const env = validateEnv({ ...VALID_ENV, PORT: '8080' });
    expect(env.PORT).toBe(8080);
  });

  it('throws on missing required field', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { PVI_BASE_URL: _url, ...rest } = VALID_ENV;
    expect(() => validateEnv(rest)).toThrow('Invalid environment variables');
  });

  it('throws on invalid URL', () => {
    expect(() =>
      validateEnv({ ...VALID_ENV, PVI_BASE_URL: 'not-a-url' }),
    ).toThrow();
  });

  it('throws when ADMIN_JWT_SECRET is shorter than 32 chars', () => {
    expect(() =>
      validateEnv({ ...VALID_ENV, ADMIN_JWT_SECRET: 'short' }),
    ).toThrow();
  });

  it('accepts ADMIN_USERNAME and ADMIN_PASSWORD when provided', () => {
    const env = validateEnv({
      ...VALID_ENV,
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'password123',
    });
    expect(env.ADMIN_USERNAME).toBe('admin');
    expect(env.ADMIN_PASSWORD).toBe('password123');
  });

  it('rejects ADMIN_PASSWORD shorter than 8 chars', () => {
    expect(() =>
      validateEnv({
        ...VALID_ENV,
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'short',
      }),
    ).toThrow();
  });
});

describe('getEnv', () => {
  it('returns env after validateEnv called', () => {
    validateEnv(VALID_ENV);
    const env = getEnv();
    expect(env.PVI_CP_ID).toBe('cp001');
  });
});
