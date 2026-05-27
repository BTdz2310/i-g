import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PartnerAuthGuard } from './partner-auth.guard';
import { SignatureService } from './signature.service';
import { createHmac } from 'crypto';
import { validateEnv } from '../config/env';

const VALID_ENV = {
  PVI_BASE_URL: 'https://pvi.example.com',
  PVI_CP_ID: 'cp',
  PVI_KEY: 'k',
  PVI_EP_GET_FEE: '/fee',
  PVI_EP_CREATE_ORDER: '/order',
  PVI_EP_CATEGORY: '/cat',
  PVI_EP_GET_VEHICLE_TYPE: '/vt',
  PVI_EP_GET_POLICY: '/pol',
  DATABASE_URL: 'postgres://localhost/test',
  REDIS_URL: 'redis://localhost',
  PARTNER_SECRET_MASTER_KEY: Buffer.alloc(32, 0x01).toString('base64'),
  ADMIN_JWT_SECRET: 'supersecretjwtsecretkey1234567890',
  PARTNER_AUTH_SIGNATURE_VERSION: 'v1',
  PARTNER_AUTH_SKEW_SECONDS: '300',
  PARTNER_AUTH_NONCE_TTL_SECONDS: '300',
};

const PARTNER = {
  id: 'partner-uuid',
  name: 'Test Partner',
  clientId: 'client-123',
  status: 'ACTIVE',
  rateLimit: 100,
  allowedIps: [],
};

const SECRET = 'test-secret-value';

const nowSec = () => Math.floor(Date.now() / 1000);

function buildRequest(
  headerOverrides: Record<string, string> = {},
  reqOverrides: Record<string, any> = {},
): Record<string, any> {
  const ts = String(nowSec());
  const nonce = 'unique-nonce-' + Date.now();
  const method = 'POST';
  const url = '/api/pvi/quote';
  const body = Buffer.from('{}');
  const sigSvc = new SignatureService();
  const bodyHash = sigSvc.sha256Hex(body);
  const canonical = sigSvc.buildCanonicalString({
    method,
    pathWithQuery: url,
    timestamp: ts,
    nonce,
    bodyHash,
  });
  const signature = createHmac('sha256', SECRET)
    .update(canonical)
    .digest('hex');

  return {
    headers: {
      'x-client-id': 'client-123',
      'x-key-id': 'key-id-1',
      'x-timestamp': ts,
      'x-nonce': nonce,
      'x-signature': signature,
      'x-signature-version': 'v1',
      ...headerOverrides,
    },
    method,
    originalUrl: url,
    url,
    rawBody: body,
    ip: '127.0.0.1',
    ...reqOverrides,
  };
}

function makeContext(req: any) {
  return { switchToHttp: () => ({ getRequest: () => req }) };
}

describe('PartnerAuthGuard', () => {
  let guard: PartnerAuthGuard;
  let partnerService: any;
  let nonceStore: any;
  let rateLimitService: any;

  beforeAll(() => validateEnv(VALID_ENV));

  beforeEach(() => {
    partnerService = {
      findActivePartnerByClientId: jest.fn().mockResolvedValue(PARTNER),
      getActiveSecret: jest.fn().mockResolvedValue(SECRET),
    };
    nonceStore = { checkAndSet: jest.fn().mockResolvedValue(true) };
    rateLimitService = { consume: jest.fn().mockResolvedValue(undefined) };
    guard = new PartnerAuthGuard(
      partnerService,
      nonceStore,
      rateLimitService,
      new SignatureService(),
    );
  });

  it('returns true for valid request', async () => {
    const req = buildRequest();
    const result = await guard.canActivate(makeContext(req) as any);
    expect(result).toBe(true);
    expect(req.partner).toMatchObject({
      id: PARTNER.id,
      clientId: PARTNER.clientId,
    });
  });

  it('throws BadRequest when headers are missing', async () => {
    const req = buildRequest({ 'x-client-id': '' });
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws Unauthorized when signature version is wrong', async () => {
    const req = buildRequest({ 'x-signature-version': 'v2' });
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized when partner not found', async () => {
    partnerService.findActivePartnerByClientId.mockResolvedValue(null);
    const req = buildRequest();
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws Forbidden when IP not in allowlist', async () => {
    partnerService.findActivePartnerByClientId.mockResolvedValue({
      ...PARTNER,
      allowedIps: ['192.168.1.1'],
    });
    const req = buildRequest();
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows when IP is in x-forwarded-for', async () => {
    partnerService.findActivePartnerByClientId.mockResolvedValue({
      ...PARTNER,
      allowedIps: ['10.0.0.1'],
    });
    const req = buildRequest(
      { 'x-forwarded-for': '10.0.0.1, 172.16.0.1' },
      { ip: '172.16.0.1' },
    );
    const result = await guard.canActivate(makeContext(req) as any);
    expect(result).toBe(true);
  });

  it('throws BadRequest for non-numeric timestamp', async () => {
    const req = buildRequest({ 'x-timestamp': 'not-a-number' });
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws Unauthorized for stale timestamp', async () => {
    const staleTs = String(nowSec() - 400);
    const req = buildRequest({ 'x-timestamp': staleTs });
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized when key not found', async () => {
    partnerService.getActiveSecret.mockResolvedValue(null);
    const req = buildRequest();
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized on wrong signature', async () => {
    const req = buildRequest({ 'x-signature': 'a'.repeat(64) });
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized on nonce replay', async () => {
    nonceStore.checkAndSet.mockResolvedValue(false);
    const req = buildRequest();
    await expect(guard.canActivate(makeContext(req) as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
