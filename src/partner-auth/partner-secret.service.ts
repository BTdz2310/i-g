import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getEnv } from '../config/env';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

@Injectable()
export class PartnerSecretService {
  private readonly masterKey: Buffer;

  constructor() {
    const key = Buffer.from(getEnv().PARTNER_SECRET_MASTER_KEY, 'base64');
    if (key.length !== 32) {
      throw new Error('PARTNER_SECRET_MASTER_KEY must be 32 bytes (base64)');
    }
    this.masterKey = key;
  }

  generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  encrypt(secret: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(secretEnc: string): string {
    const data = Buffer.from(secretEnc, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
