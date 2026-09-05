export interface AppConfig {
  port: number;
  webOrigin: string;
}

export interface RedisConfig {
  url: string;
}

export interface AuthConfig {
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  jwtRefreshTtlSeconds: number;
  argon2: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
  mfaEncryptionKey: string;
  passwordResetTokenTtlMinutes: number;
  emailVerificationTokenTtlHours: number;
  cookieSecret: string;
}

// Values are guaranteed present by envValidationSchema before this factory runs.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default () => ({
  app: {
    port: Number(process.env.API_PORT ?? 3000),
    webOrigin: requireEnv('WEB_ORIGIN'),
  } satisfies AppConfig,
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  } satisfies RedisConfig,
  auth: {
    jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
    jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    jwtRefreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2_592_000),
    argon2: {
      memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19_456),
      timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
      parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
    },
    mfaEncryptionKey: requireEnv('MFA_ENCRYPTION_KEY'),
    passwordResetTokenTtlMinutes: Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? 60),
    emailVerificationTokenTtlHours: Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS ?? 48),
    cookieSecret: requireEnv('COOKIE_SECRET'),
  } satisfies AuthConfig,
});
