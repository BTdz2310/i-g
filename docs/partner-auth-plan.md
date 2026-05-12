# Partner HMAC Auth Plan (B2B)

This plan defines an API key + HMAC-SHA256 authentication model for partner level 2 (your B2B clients). It targets all /proxy endpoints and excludes /callback and /docs.

## Goals

- Server-to-server auth with replay protection.
- Simple partner onboarding (clientId + secret).
- Deterministic signature validation with canonical string.
- Scales to multiple partners and supports key rotation.

## Request Contract

Required headers:

- X-Client-Id: partner clientId
- X-Key-Id: key identifier for rotation
- X-Timestamp: unix epoch seconds
- X-Nonce: random UUID
- X-Signature-Version: v1
- X-Signature: hex(HMAC-SHA256(secret, canonicalString))

Timestamp rules:

- Allowed skew: <= 5 minutes

Nonce rules:

- Nonce must be unique per clientId in the allowed window
- TTL in Redis: 5 minutes (or a bit longer than timestamp window)
- Redis key format (bucketed): auth:nonce:{clientId}:{epochMinute}:{nonce}

## Canonical String

Format:
METHOD\nPATH_WITH_QUERY\nTIMESTAMP\nNONCE\nBODY_SHA256

Details:

- METHOD: uppercase HTTP method
- PATH_WITH_QUERY: path + raw query order as received. Do not sort. Example: /proxy/quote?foo=1&z=2
- TIMESTAMP: from header as-is
- NONCE: from header as-is
- BODY_SHA256: hex(sha256(rawRequestBodyBytes))
- If no body: BODY_SHA256 = sha256("")

## Validation Flow (Gateway)

1. Read headers, reject missing values (400).
2. Enforce rate limit (Redis) before HMAC verification.
3. Verify timestamp is within allowed skew (401).
4. Check nonce uniqueness in Redis using key auth:nonce:{clientId}:{epochMinute}:{nonce}. If exists -> reject (401).
5. Compute body hash from raw request bytes.
6. Canonicalize request and compute HMAC-SHA256.
7. Compare signature using timing-safe equality.
8. Verify partner status == ACTIVE and IP allowlist (if configured).
9. Continue to handler.

## Data Model (Prisma)

Add models:

model Partner {
id String @id @default(uuid())
name String
clientId String @unique
status PartnerStatus
rateLimit Int
allowedIps String[]
secrets PartnerSecret[]
createdAt DateTime @default(now())
}

model PartnerSecret {
id String @id @default(uuid())
partnerId String
keyId String
secretEnc String // encrypted secret (AES-GCM)
status SecretStatus
createdAt DateTime @default(now())

partner Partner @relation(fields: [partnerId], references: [id])

@@unique([partnerId, keyId])
@@index([keyId])
}

enum PartnerStatus {
ACTIVE
DISABLED
}

enum SecretStatus {
ACTIVE
REVOKED
}

Notes:

- Store secrets encrypted (not hashed) so HMAC can be verified.
- Encryption uses a master key from env (AES-256-GCM).

## Config (env.ts)

Add settings:

- REDIS_URL
- PARTNER_AUTH_SKEW_SECONDS (default 300)
- PARTNER_AUTH_NONCE_TTL_SECONDS (default 300)
- PARTNER_SECRET_MASTER_KEY (base64 32 bytes)

## Modules and Services

1. PartnerModule

- PartnerService: find active partner + secret by clientId + keyId
- PartnerSecretService: encrypt/decrypt secret, rotate secrets

2. SignatureService

- buildCanonicalString(req)
- sha256Hex(buffer)
- hmacSha256Hex(secret, canonical)

3. NonceStore (Redis)

- setIfAbsent(key, ttlSeconds) -> boolean

4. PartnerAuthGuard

- Applies to /proxy routes
- Exclude /callback and /docs
- Uses SignatureService + PartnerService + NonceStore

## Raw Body Capture

In main.ts, configure body parser with a verify hook:

- Save req.rawBody Buffer before JSON parsing.
- Use rawBody for hashing.

## Admin APIs (internal)

Add in admin module:

- POST /admin/partners
  - create partner, return clientId + secret (one time)
- POST /admin/partners/:id/rotate-secret
  - generate new secret with new keyId
- PATCH /admin/partners/:id/status
  - enable/disable
- GET /admin/partners
  - list partners (no secrets)

## Error Responses

Use consistent JSON errors:

- 400: missing headers, invalid body
- 401: invalid signature, stale timestamp, replay nonce
- 403: partner disabled or IP not allowed

## Logging Security

Never log:

- nonce
- signature
- full headers
  Only log:
- clientId
- requestId
- reason

## Tests

Unit:

- canonical string with query sorting
- body hash for empty body
- signature verification (valid/invalid)

E2E:

- valid signed request passes
- invalid signature rejected
- stale timestamp rejected
- reused nonce rejected

## Rollout Notes

- Provide partners with signing guide + sample code.
- Log auth failures with request id and reason (no secrets).
- Consider rate limit in Redis (phase 2).
