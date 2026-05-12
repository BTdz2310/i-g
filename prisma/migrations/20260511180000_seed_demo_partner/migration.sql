-- Seed a demo partner for local/dev testing.
-- Secret creation is intentionally left to the admin API because PartnerSecret
-- encryption depends on the environment-specific PARTNER_SECRET_MASTER_KEY.

INSERT INTO "Partner" (
  "id",
  "name",
  "clientId",
  "status",
  "rateLimit",
  "allowedIps",
  "createdAt"
)
VALUES (
  '2f3f0e8f-2f1f-4e0d-9a47-8af6b9b58e11',
  'Demo Agency',
  'partner-demo-001',
  'ACTIVE',
  60,
  ARRAY[]::TEXT[],
  CURRENT_TIMESTAMP
)
ON CONFLICT ("clientId") DO NOTHING;