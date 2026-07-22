import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),
  API_PORT: Joi.number().port().default(3000),
  WEB_ORIGIN: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL_SECONDS: Joi.number().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: Joi.number().positive().default(2_592_000),

  ARGON2_MEMORY_COST: Joi.number().positive().default(19_456),
  ARGON2_TIME_COST: Joi.number().positive().default(2),
  ARGON2_PARALLELISM: Joi.number().positive().default(1),

  MFA_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),

  PASSWORD_RESET_TOKEN_TTL_MINUTES: Joi.number().positive().default(60),
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: Joi.number().positive().default(48),

  COOKIE_SECRET: Joi.string().min(32).required(),
});
