import { Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class SignatureService {
  sha256Hex(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  hmacSha256Hex(secret: string, canonical: string): string {
    return createHmac('sha256', secret).update(canonical).digest('hex');
  }

  buildCanonicalString(input: {
    method: string;
    pathWithQuery: string;
    timestamp: string;
    nonce: string;
    bodyHash: string;
  }): string {
    return [
      input.method.toUpperCase(),
      input.pathWithQuery,
      input.timestamp,
      input.nonce,
      input.bodyHash,
    ].join('\n');
  }

  timingSafeEqualsHex(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
