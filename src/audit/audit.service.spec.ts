import { AuditService } from './audit.service';

const makePrisma = () => ({
  apiCallLog: {
    create: jest.fn().mockResolvedValue({ id: '1' }),
  },
});

describe('AuditService', () => {
  let svc: AuditService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new AuditService(prisma as any);
  });

  describe('logOut', () => {
    it('creates OUT_TO_PVI record', async () => {
      await svc.logOut(
        '/fee',
        { ma_giaodich: 'GD-1' },
        { result: 'ok' },
        200,
        123,
        'GD-1',
      );
      expect(prisma.apiCallLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'OUT_TO_PVI',
          endpoint: '/fee',
          statusCode: 200,
          durationMs: 123,
          maGiaodich: 'GD-1',
        }),
      });
    });

    it('masks sensitive fields in request and response', async () => {
      await svc.logOut(
        '/order',
        { sign: 'secret123', amount: 100 },
        { token: 'tok', ok: true },
        200,
        50,
      );
      const call = prisma.apiCallLog.create.mock.calls[0][0];
      expect(call.data.request.sign).toBe('***');
      expect(call.data.request.amount).toBe(100);
      expect(call.data.response.token).toBe('***');
      expect(call.data.response.ok).toBe(true);
    });

    it('sets maGiaodich to null when not provided', async () => {
      await svc.logOut('/fee', {}, {}, 200, 10);
      const call = prisma.apiCallLog.create.mock.calls[0][0];
      expect(call.data.maGiaodich).toBeNull();
    });

    it('sets errorMsg when provided', async () => {
      await svc.logOut('/fee', {}, {}, 500, 100, undefined, 'timeout');
      const call = prisma.apiCallLog.create.mock.calls[0][0];
      expect(call.data.errorMsg).toBe('timeout');
    });

    it('sets errorMsg to null when not provided', async () => {
      await svc.logOut('/fee', {}, {}, 200, 10);
      const call = prisma.apiCallLog.create.mock.calls[0][0];
      expect(call.data.errorMsg).toBeNull();
    });
  });

  describe('logIn', () => {
    it('creates IN_FROM_PVI record', async () => {
      await svc.logIn('/callback', { RequestId: 'R1' }, 200, 5, 'GD-2');
      expect(prisma.apiCallLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'IN_FROM_PVI',
          endpoint: '/callback',
          statusCode: 200,
          durationMs: 5,
          maGiaodich: 'GD-2',
        }),
      });
    });

    it('sets maGiaodich to null when not provided', async () => {
      await svc.logIn('/callback', {}, 200, 5);
      const call = prisma.apiCallLog.create.mock.calls[0][0];
      expect(call.data.maGiaodich).toBeNull();
    });

    it('does not include response field', async () => {
      await svc.logIn('/callback', {}, 200, 5);
      const call = prisma.apiCallLog.create.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('response');
    });
  });
});
