import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

const makePrisma = (succeeds: boolean) => ({
  $queryRaw: jest.fn().mockImplementation(() =>
    succeeds ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('DB down')),
  ),
});

const makeRedis = (pong: string | null) => ({
  getClient: () => ({
    ping: jest.fn().mockImplementation(() =>
      pong !== null ? Promise.resolve(pong) : Promise.reject(new Error('Redis down')),
    ),
  }),
});

describe('HealthController', () => {
  describe('live', () => {
    it('returns ok status', () => {
      const ctrl = new HealthController(makePrisma(true) as any, makeRedis('PONG') as any);
      const result = ctrl.live();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('ready', () => {
    it('returns ok when DB and Redis are up', async () => {
      const ctrl = new HealthController(makePrisma(true) as any, makeRedis('PONG') as any);
      const result = await ctrl.ready();
      expect(result.status).toBe('ok');
      expect(result.checks.database).toBe('up');
      expect(result.checks.redis).toBe('up');
    });

    it('throws 503 when DB is down', async () => {
      const ctrl = new HealthController(makePrisma(false) as any, makeRedis('PONG') as any);
      await expect(ctrl.ready()).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws 503 when Redis is down', async () => {
      const ctrl = new HealthController(makePrisma(true) as any, makeRedis(null) as any);
      await expect(ctrl.ready()).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws 503 when Redis returns non-PONG', async () => {
      const ctrl = new HealthController(makePrisma(true) as any, makeRedis('ERR') as any);
      await expect(ctrl.ready()).rejects.toThrow(ServiceUnavailableException);
    });

    it('includes checks in thrown exception response', async () => {
      const ctrl = new HealthController(makePrisma(false) as any, makeRedis('PONG') as any);
      try {
        await ctrl.ready();
        fail('should have thrown');
      } catch (e: any) {
        expect(e.getResponse()).toMatchObject({
          status: 'error',
          checks: { database: 'down', redis: 'up' },
        });
      }
    });

    it('throws 503 when both DB and Redis are down', async () => {
      const ctrl = new HealthController(makePrisma(false) as any, makeRedis(null) as any);
      await expect(ctrl.ready()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
