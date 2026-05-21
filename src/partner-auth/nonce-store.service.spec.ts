import { NonceStoreService } from './nonce-store.service';

const makeClient = (setResult: string | null) => ({
  set: jest.fn().mockResolvedValue(setResult),
});

describe('NonceStoreService', () => {
  it('returns true when Redis returns OK (first use)', async () => {
    const client = makeClient('OK');
    const svc = new NonceStoreService({ getClient: () => client } as any);
    const result = await svc.checkAndSet('client1', 'nonce-abc', 1700000000, 300);
    expect(result).toBe(true);
  });

  it('returns false when Redis returns null (replay)', async () => {
    const client = makeClient(null);
    const svc = new NonceStoreService({ getClient: () => client } as any);
    const result = await svc.checkAndSet('client1', 'nonce-abc', 1700000000, 300);
    expect(result).toBe(false);
  });

  it('calls set with NX flag and correct EX TTL', async () => {
    const client = makeClient('OK');
    const svc = new NonceStoreService({ getClient: () => client } as any);
    await svc.checkAndSet('clientX', 'nonce-xyz', 1700000000, 600);
    expect(client.set).toHaveBeenCalledWith(
      expect.stringContaining('nonce-xyz'),
      '1',
      { NX: true, EX: 600 },
    );
  });

  it('uses bucket key derived from timestamp / 60', async () => {
    const client = makeClient('OK');
    const svc = new NonceStoreService({ getClient: () => client } as any);
    const ts = 1700000060; // bucket = floor(1700000060/60) = 28333334
    await svc.checkAndSet('client1', 'n1', ts, 300);
    const key: string = client.set.mock.calls[0][0];
    expect(key).toContain(String(Math.floor(ts / 60)));
  });

  it('includes clientId and nonce in key', async () => {
    const client = makeClient('OK');
    const svc = new NonceStoreService({ getClient: () => client } as any);
    await svc.checkAndSet('my-client', 'unique-nonce', 1700000000, 300);
    const key: string = client.set.mock.calls[0][0];
    expect(key).toContain('my-client');
    expect(key).toContain('unique-nonce');
  });
});
