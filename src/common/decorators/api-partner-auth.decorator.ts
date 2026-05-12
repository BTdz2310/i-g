import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export const PARTNER_AUTH_SCHEMES = [
  'X-Client-Id',
  'X-Key-Id',
  'X-Timestamp',
  'X-Nonce',
  'X-Signature-Version',
  'X-Signature',
] as const;

const HEADER_DESCRIPTIONS: Record<string, string> = {
  'X-Client-Id': 'Partner client ID',
  'X-Key-Id': 'Key ID (từ rotate-secret)',
  'X-Timestamp': 'Unix epoch seconds (valid ±5 phút)',
  'X-Nonce': 'UUID ngẫu nhiên, dùng một lần',
  'X-Signature-Version': 'Luôn là v1',
  'X-Signature': 'hex(HMAC-SHA256(secret, canonical))',
};

export const ApiPartnerAuth = () =>
  applyDecorators(
    ...PARTNER_AUTH_SCHEMES.map((name) =>
      ApiHeader({ name, description: HEADER_DESCRIPTIONS[name], required: true }),
    ),
  );
