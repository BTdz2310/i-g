import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

const RATE_BUCKET_TTL_SEC = 120;

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consume(clientId: string, limit: number) {
    if (!limit || limit <= 0) return;

    const bucket = Math.floor(Date.now() / 60000);
    const key = `auth:rl:${clientId}:${bucket}`;
    const count = await this.redis.getClient().incr(key);

    if (count === 1) {
      await this.redis.getClient().expire(key, RATE_BUCKET_TTL_SEC);
    }

    if (count > limit) {
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
