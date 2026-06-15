import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getEnv } from '../config/env';

export interface AdminTokenPayload {
  adminId: string;
  username: string;
  jti?: string;
}

@Injectable()
export class AdminJwtService {
  sign(payload: AdminTokenPayload): { token: string; expiresIn: string } {
    const env = getEnv();
    const ttl = env.ADMIN_ACCESS_TOKEN_TTL;
    const token = jwt.sign(
      { ...payload, jti: randomUUID() },
      env.ADMIN_JWT_SECRET,
      {
        expiresIn: ttl as jwt.SignOptions['expiresIn'],
        algorithm: 'HS256',
      },
    );
    return { token, expiresIn: ttl };
  }

  verify(token: string): AdminTokenPayload {
    const env = getEnv();
    return jwt.verify(token, env.ADMIN_JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AdminTokenPayload;
  }
}
