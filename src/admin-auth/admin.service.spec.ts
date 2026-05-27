import { AdminService } from './admin.service';
import { validateEnv } from '../config/env';

const BASE_ENV = {
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
};

const makePrisma = (overrides: Record<string, any> = {}) => ({
  admin: {
    findUnique: jest.fn(),
    create: jest.fn(),
    ...overrides,
  },
});

describe('AdminService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findByUsername', () => {
    it('delegates to prisma', async () => {
      validateEnv({ ...BASE_ENV });
      const prisma = makePrisma();
      prisma.admin.findUnique.mockResolvedValue({ id: '1', username: 'admin' });
      const svc = new AdminService(prisma as any);
      const result = await svc.findByUsername('admin');
      expect(result).toEqual({ id: '1', username: 'admin' });
      expect(prisma.admin.findUnique).toHaveBeenCalledWith({
        where: { username: 'admin' },
      });
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password', async () => {
      validateEnv({ ...BASE_ENV });
      const prisma = makePrisma();
      const svc = new AdminService(prisma as any);
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('my-password', 10);
      await expect(svc.verifyPassword('my-password', hash)).resolves.toBe(true);
    });

    it('returns false for wrong password', async () => {
      validateEnv({ ...BASE_ENV });
      const prisma = makePrisma();
      const svc = new AdminService(prisma as any);
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correct', 10);
      await expect(svc.verifyPassword('wrong', hash)).resolves.toBe(false);
    });
  });

  describe('onModuleInit / seedFromEnv', () => {
    it('skips seed when ADMIN_USERNAME not set', async () => {
      validateEnv({ ...BASE_ENV });
      const prisma = makePrisma();
      const svc = new AdminService(prisma as any);
      await svc.onModuleInit();
      expect(prisma.admin.create).not.toHaveBeenCalled();
    });

    it('skips seed when admin already exists', async () => {
      validateEnv({
        ...BASE_ENV,
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'password123',
      });
      const prisma = makePrisma();
      prisma.admin.findUnique.mockResolvedValue({ id: '1', username: 'admin' });
      const svc = new AdminService(prisma as any);
      await svc.onModuleInit();
      expect(prisma.admin.create).not.toHaveBeenCalled();
    });

    it('creates admin when not exists', async () => {
      validateEnv({
        ...BASE_ENV,
        ADMIN_USERNAME: 'newadmin',
        ADMIN_PASSWORD: 'securepass1',
      });
      const prisma = makePrisma();
      prisma.admin.findUnique.mockResolvedValue(null);
      prisma.admin.create.mockResolvedValue({ id: '2', username: 'newadmin' });
      const svc = new AdminService(prisma as any);
      await svc.onModuleInit();
      expect(prisma.admin.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.admin.create.mock.calls[0][0];
      expect(createCall.data.username).toBe('newadmin');
      expect(typeof createCall.data.passwordHash).toBe('string');
    });

    it('ignores P2002 unique constraint error on race condition', async () => {
      validateEnv({
        ...BASE_ENV,
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'securepass1',
      });
      const prisma = makePrisma();
      prisma.admin.findUnique.mockResolvedValue(null);
      prisma.admin.create.mockRejectedValue({ code: 'P2002' });
      const svc = new AdminService(prisma as any);
      await expect(svc.onModuleInit()).resolves.toBeUndefined();
    });

    it('rethrows non-P2002 errors', async () => {
      validateEnv({
        ...BASE_ENV,
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'securepass1',
      });
      const prisma = makePrisma();
      prisma.admin.findUnique.mockResolvedValue(null);
      prisma.admin.create.mockRejectedValue(new Error('DB connection lost'));
      const svc = new AdminService(prisma as any);
      await expect(svc.onModuleInit()).rejects.toThrow('DB connection lost');
    });
  });
});
