import { HttpStatus } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

const makeRedis = (incrValue: number) => ({
  incr: jest.fn().mockResolvedValue(incrValue),
  expire: jest.fn().mockResolvedValue(1),
});

const makeRedisService = (incrValue: number) => ({
  getClient: () => makeRedis(incrValue),
});

describe('RateLimitService', () => {
  it('does nothing when limit is 0', async () => {
    const redis = { getClient: jest.fn() };
    const svc = new RateLimitService(redis as any);
    await expect(svc.consume('client1', 0)).resolves.toBeUndefined();
    expect(redis.getClient).not.toHaveBeenCalled();
  });

  it('does nothing when limit is negative', async () => {
    const redis = { getClient: jest.fn() };
    const svc = new RateLimitService(redis as any);
    await expect(svc.consume('client1', -5)).resolves.toBeUndefined();
  });

  it('allows request when count is within limit', async () => {
    const svc = new RateLimitService(makeRedisService(1) as any);
    await expect(svc.consume('client1', 100)).resolves.toBeUndefined();
  });

  it('sets expire when count equals 1 (first request in bucket)', async () => {
    const client = makeRedis(1);
    const svc = new RateLimitService({ getClient: () => client } as any);
    await svc.consume('client1', 100);
    expect(client.expire).toHaveBeenCalledTimes(1);
  });

  it('does not call expire when count > 1', async () => {
    const client = makeRedis(5);
    const svc = new RateLimitService({ getClient: () => client } as any);
    await svc.consume('client1', 100);
    expect(client.expire).not.toHaveBeenCalled();
  });

  it('throws TOO_MANY_REQUESTS when count exceeds limit', async () => {
    const svc = new RateLimitService(makeRedisService(11) as any);
    await expect(svc.consume('client1', 10)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('throws when count equals limit + 1', async () => {
    const svc = new RateLimitService(makeRedisService(6) as any);
    await expect(svc.consume('clientX', 5)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('allows request when count equals limit exactly', async () => {
    const svc = new RateLimitService(makeRedisService(5) as any);
    await expect(svc.consume('clientX', 5)).resolves.toBeUndefined();
  });
});
