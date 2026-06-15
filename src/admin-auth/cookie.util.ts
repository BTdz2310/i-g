import { Response } from 'express';
import { randomBytes } from 'crypto';
import { getEnv } from '../config/env';

function parseTtlMs(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit === 's') return n * 1000;
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 3600 * 1000;
  if (unit === 'd') return n * 86400 * 1000;
  return 15 * 60 * 1000;
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshRaw: string,
  refreshExpiresAt: Date,
): string {
  const env = getEnv();
  const secure = env.ADMIN_COOKIE_SECURE;
  const domain = env.ADMIN_COOKIE_DOMAIN;
  const accessMaxAge = parseTtlMs(env.ADMIN_ACCESS_TOKEN_TTL);
  const refreshMaxAge = refreshExpiresAt.getTime() - Date.now();
  const csrfToken = randomBytes(24).toString('base64url');

  const base = { httpOnly: true, secure, sameSite: 'strict' as const, ...(domain ? { domain } : {}) };

  res.cookie('access_token', accessToken, {
    ...base,
    path: '/admin',
    maxAge: accessMaxAge,
  });

  res.cookie('refresh_token', refreshRaw, {
    ...base,
    path: '/admin/auth',
    maxAge: refreshMaxAge,
  });

  // csrf_token: NOT httpOnly — JS needs to read and send as header
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'strict' as const,
    path: '/admin',
    maxAge: refreshMaxAge,
    ...(domain ? { domain } : {}),
  });

  return csrfToken;
}

export function clearAuthCookies(res: Response): void {
  const env = getEnv();
  const domain = env.ADMIN_COOKIE_DOMAIN;
  const base = { ...(domain ? { domain } : {}) };

  res.clearCookie('access_token', { ...base, path: '/admin' });
  res.clearCookie('refresh_token', { ...base, path: '/admin/auth' });
  res.clearCookie('csrf_token', { ...base, path: '/admin' });
}
