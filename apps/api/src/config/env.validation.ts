import * as Joi from 'joi';

// The exact placeholder strings `.env.example` ships — both happen to be
// long enough (>32 chars) to pass `.min(32)` on their own, so a `.env`
// copied without actually generating real secrets would otherwise boot
// "successfully" with a publicly-known, guessable value protecting every
// signed session/cookie in that environment. Milestone 8 production
// hardening: rejected unconditionally (not just when NODE_ENV=production),
// since no environment — including a shared dev/staging box — should ever
// actually run on the literal example value. `MFA_ENCRYPTION_KEY`'s own
// placeholder ("replace-with-64-hex-characters") needs no equivalent check:
// it already fails `.hex()` below since it isn't valid hex.
const PLACEHOLDER_SECRET = 'replace-with-a-random-32-byte-minimum-secret';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

  DATABASE_URL: Joi.string().uri().required(),
  API_PORT: Joi.number().port().default(3000),
  WEB_ORIGIN: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).invalid(PLACEHOLDER_SECRET).required(),
  JWT_ACCESS_TTL_SECONDS: Joi.number().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: Joi.number().positive().default(2_592_000),

  ARGON2_MEMORY_COST: Joi.number().positive().default(19_456),
  ARGON2_TIME_COST: Joi.number().positive().default(2),
  ARGON2_PARALLELISM: Joi.number().positive().default(1),

  MFA_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),

  PASSWORD_RESET_TOKEN_TTL_MINUTES: Joi.number().positive().default(60),
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: Joi.number().positive().default(48),

  COOKIE_SECRET: Joi.string().min(32).invalid(PLACEHOLDER_SECRET).required(),

  // Provisioned in docker-compose since ADR-0002 but unwired until Fellowship
  // Chat (docs/adr/0014-fellowship-chat.md) needed cross-instance pub/sub for
  // its WebSocket gateway. Defaulted, not required, so every environment that
  // predates this feature keeps working unchanged.
  REDIS_URL: Joi.string().uri().default('redis://localhost:6379'),

  // All optional and unset by default — `IdentityModule` falls back to the
  // dev-mode `ConsoleEmailAdapter` (logs instead of sending) whenever
  // `SMTP_HOST` is absent, so no environment breaks by not having these.
  // Set all of `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` (plus
  // optionally `SMTP_PORT`/`SMTP_SECURE`) to switch to real delivery — see
  // docs/adr/0009-administration-platform.md's 2026-09-06 email addendum.
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  SMTP_FROM: Joi.string().optional(),
});
