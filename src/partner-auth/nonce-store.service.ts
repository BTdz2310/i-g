import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class NonceStoreService {
  constructor(private readonly redis: RedisService) {}

  async checkAndSet(
    clientId: string,
    nonce: string,
    timestampSec: number,
    ttlSeconds: number,
  ): Promise<boolean> {
    const bucket = Math.floor(timestampSec / 60);
    const key = `auth:nonce:${clientId}:${bucket}:${nonce}`;
    const result = await this.redis.getClient().set(key, '1', {
      NX: true,
      EX: ttlSeconds,
    });
    return result === 'OK';
  }
}
