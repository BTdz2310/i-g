import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { getEnv } from '../config/env';

export interface AdminTokenPayload {
  adminId: string;
  username: string;
}

@Injectable()
export class AdminJwtService {
  sign(payload: AdminTokenPayload): { token: string; expiresIn: string } {
    const env = getEnv();
    const token = jwt.sign(payload, env.ADMIN_JWT_SECRET, {
      expiresIn: env.ADMIN_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    });
    return { token, expiresIn: env.ADMIN_JWT_EXPIRES_IN };
  }

  verify(token: string): AdminTokenPayload {
    const env = getEnv();
    return jwt.verify(token, env.ADMIN_JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AdminTokenPayload;
  }
}
