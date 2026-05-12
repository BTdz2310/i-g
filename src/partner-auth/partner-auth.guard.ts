import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { getEnv } from '../config/env';
import { NonceStoreService } from './nonce-store.service';
import { PartnerService } from './partner.service';
import { RateLimitService } from './rate-limit.service';
import { SignatureService } from './signature.service';
import { RawBodyRequest } from '../common/types/raw-body';

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  private readonly logger = new Logger(PartnerAuthGuard.name);

  constructor(
    private readonly partnerService: PartnerService,
    private readonly nonceStore: NonceStoreService,
    private readonly rateLimit: RateLimitService,
    private readonly signatureService: SignatureService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RawBodyRequest>();
    const env = getEnv();

    const clientId = this.getHeader(req, 'x-client-id');
    const keyId = this.getHeader(req, 'x-key-id');
    const timestamp = this.getHeader(req, 'x-timestamp');
    const nonce = this.getHeader(req, 'x-nonce');
    const signature = this.getHeader(req, 'x-signature');
    const signatureVersion = this.getHeader(req, 'x-signature-version');

    if (
      !clientId ||
      !keyId ||
      !timestamp ||
      !nonce ||
      !signature ||
      !signatureVersion
    ) {
      this.logFailure(clientId, req, 'missing_headers');
      throw new BadRequestException('Missing authentication headers');
    }

    if (signatureVersion !== env.PARTNER_AUTH_SIGNATURE_VERSION) {
      this.logFailure(clientId, req, 'invalid_signature_version');
      throw new UnauthorizedException('Invalid signature version');
    }

    const partner =
      await this.partnerService.findActivePartnerByClientId(clientId);
    if (!partner) {
      this.logFailure(clientId, req, 'invalid_client');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      partner.allowedIps.length > 0 &&
      !this.isAllowedIp(req, partner.allowedIps)
    ) {
      this.logFailure(clientId, req, 'ip_not_allowed');
      throw new ForbiddenException('IP not allowed');
    }

    await this.rateLimit.consume(clientId, partner.rateLimit);

    const timestampSec = Number(timestamp);
    if (!Number.isFinite(timestampSec)) {
      this.logFailure(clientId, req, 'invalid_timestamp');
      throw new BadRequestException('Invalid timestamp');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestampSec) > env.PARTNER_AUTH_SKEW_SECONDS) {
      this.logFailure(clientId, req, 'timestamp_skew');
      throw new UnauthorizedException('Stale timestamp');
    }

    const secret = await this.partnerService.getActiveSecret(partner.id, keyId);
    if (!secret) {
      this.logFailure(clientId, req, 'invalid_key');
      throw new UnauthorizedException('Invalid credentials');
    }

    const rawBody = req.rawBody ?? Buffer.from('');
    const bodyHash = this.signatureService.sha256Hex(rawBody);
    const pathWithQuery = req.originalUrl ?? req.url;

    const canonical = this.signatureService.buildCanonicalString({
      method: req.method,
      pathWithQuery,
      timestamp,
      nonce,
      bodyHash,
    });

    const expected = this.signatureService.hmacSha256Hex(secret, canonical);
    if (!this.signatureService.timingSafeEqualsHex(expected, signature)) {
      this.logFailure(clientId, req, 'invalid_signature');
      throw new UnauthorizedException('Invalid signature');
    }

    // Nonce claim phải đặt SAU khi HMAC verify pass — nếu không attacker có thể
    // "burn" nonce hợp lệ của partner bằng request rác → DoS chính chủ.
    const nonceOk = await this.nonceStore.checkAndSet(
      clientId,
      nonce,
      timestampSec,
      env.PARTNER_AUTH_NONCE_TTL_SECONDS,
    );
    if (!nonceOk) {
      this.logFailure(clientId, req, 'replay_nonce');
      throw new UnauthorizedException('Replay detected');
    }

    (
      req as Request & {
        partner?: { id: string; clientId: string; name: string };
      }
    ).partner = {
      id: partner.id,
      clientId: partner.clientId,
      name: partner.name,
    };

    return true;
  }

  private getHeader(req: Request, name: string): string | undefined {
    const value = req.headers[name] ?? req.headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string' && value.length > 0) return value;
    return undefined;
  }

  private isAllowedIp(req: Request, allowedIps: string[]): boolean {
    const directIp = req.ip;
    if (directIp && allowedIps.includes(directIp)) return true;

    const forwarded =
      (req.headers['x-forwarded-for'] as string | undefined) ?? '';
    const forwardedIp = forwarded.split(',')[0]?.trim();
    if (forwardedIp && allowedIps.includes(forwardedIp)) return true;

    return false;
  }

  private logFailure(
    clientId: string | undefined,
    req: Request,
    reason: string,
  ) {
    const requestId = this.getHeader(req, 'x-request-id') ?? '';
    this.logger.warn(
      `auth_failed clientId=${clientId ?? ''} requestId=${requestId} reason=${reason}`,
    );
  }
}
