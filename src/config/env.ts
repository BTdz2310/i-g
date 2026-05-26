import { z } from 'zod';

const envSchema = z.object({
  PVI_BASE_URL: z.string().url(),
  PVI_CP_ID: z.string().min(1),
  PVI_KEY: z.string().min(1),

  PVI_EP_GET_FEE: z.string().min(1),
  PVI_EP_CREATE_ORDER: z.string().min(1),
  PVI_EP_CATEGORY: z.string().min(1),
  PVI_EP_GET_VEHICLE_TYPE: z.string().min(1),
  PVI_EP_GET_POLICY: z.string().min(1),
  PVI_EP_GET_FEE_MOTO: z.string().min(1),
  PVI_EP_CREATE_ORDER_MOTO: z.string().min(1),

  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),

  CATEGORY_CACHE_TTL_SEC: z.coerce.number().default(21600),
  RECONCILE_INTERVAL_MIN: z.coerce.number().default(5),
  RECONCILE_GRACE_MIN: z.coerce.number().default(10),
  RECONCILE_MAX_ATTEMPTS: z.coerce.number().default(20),
  HTTP_TIMEOUT_MS: z.coerce.number().default(15000),

  REDIS_URL: z.string().min(1),
  PARTNER_AUTH_SKEW_SECONDS: z.coerce.number().default(300),
  PARTNER_AUTH_NONCE_TTL_SECONDS: z.coerce.number().default(300),
  PARTNER_AUTH_SIGNATURE_VERSION: z.string().default('v1'),
  PARTNER_SECRET_MASTER_KEY: z.string().min(1),

  ADMIN_JWT_SECRET: z.string().min(32),
  ADMIN_JWT_EXPIRES_IN: z.string().default('12h'),
  ADMIN_USERNAME: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${result.error.toString()}`);
  }
  _env = result.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) throw new Error('env not initialised — call validateEnv first');
  return _env;
}
