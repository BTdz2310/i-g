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
    PVI_EP_GET_FEE_MOTO: '/fee-moto',
    PVI_EP_CREATE_ORDER_MOTO: '/order-moto',
    DATABASE_URL: 'postgres://localhost/test',
    REDIS_URL: 'redis://localhost',
    PARTNER_SECRET_MASTER_KEY: Buffer.alloc(32, 0x01).toString('base64'),
    ADMIN_JWT_SECRET: 'supersecretjwtsecretkey1234567890',
  });
});

const mockClient = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockClient),
}));

import { RedisService } from './redis.service';

describe('RedisService', () => {
  let svc: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.on.mockImplementation(() => mockClient);
    svc = new RedisService();
  });

  it('connects on onModuleInit', async () => {
    await svc.onModuleInit();
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
  });

  it('quits on onModuleDestroy', async () => {
    await svc.onModuleDestroy();
    expect(mockClient.quit).toHaveBeenCalledTimes(1);
  });

  it('getClient returns the redis client', () => {
    expect(svc.getClient()).toBe(mockClient);
  });

  it('registers error handler on construction', () => {
    expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
