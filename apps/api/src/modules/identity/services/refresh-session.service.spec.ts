import { AppConfigService } from '../../../config/app-config.service';
import { hashOpaqueToken } from '../../../shared/crypto/opaque-token';
import { AppException } from '../../../shared/errors/app.exception';
import type { AuthSessionsRepository } from '../repositories/auth-sessions.repository';
import { RefreshSessionService } from './refresh-session.service';

function fakeConfig(): AppConfigService {
  return { auth: { jwtRefreshTtlSeconds: 2_592_000 } } as unknown as AppConfigService;
}

interface StoredSession {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  mfaVerifiedAt: Date | null;
}

function fakeSessionsRepository() {
  const sessions = new Map<string, StoredSession>();
  let counter = 0;

  const repo: Partial<AuthSessionsRepository> = {
    create: jest.fn(async (input) => {
      const id = `session-${++counter}`;
      const session: StoredSession = {
        id,
        userId: input.userId,
        familyId: input.familyId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        mfaVerifiedAt: input.mfaVerifiedAt ?? null,
      };
      sessions.set(id, session);
      return session as never;
    }),
    findByRefreshTokenHash: jest.fn(async (hash) => {
      for (const session of sessions.values()) {
        if (session.refreshTokenHash === hash) return session as never;
      }
      return null;
    }),
    revoke: jest.fn(async (id) => {
      const session = sessions.get(id)!;
      session.revokedAt = new Date();
      return session as never;
    }),
    revokeFamily: jest.fn(async (familyId) => {
      let count = 0;
      for (const session of sessions.values()) {
        if (session.familyId === familyId && !session.revokedAt) {
          session.revokedAt = new Date();
          count += 1;
        }
      }
      return { count };
    }),
  };

  return { repo: repo as AuthSessionsRepository, sessions };
}

describe('RefreshSessionService', () => {
  it('rotates a valid refresh token and revokes the old one', async () => {
    const { repo } = fakeSessionsRepository();
    const service = new RefreshSessionService(repo, fakeConfig());

    const started = await service.startSession('user-1', {});
    const rotated = await service.rotate(started.token, {});

    expect(rotated.userId).toBe('user-1');
    expect(rotated.token).not.toBe(started.token);

    // The original token can no longer be used.
    await expect(service.rotate(started.token, {})).rejects.toThrow(AppException);
  });

  it('revokes the entire session family on refresh-token reuse (theft response)', async () => {
    const { repo, sessions } = fakeSessionsRepository();
    const service = new RefreshSessionService(repo, fakeConfig());

    const started = await service.startSession('user-1', {});
    const firstRotation = await service.rotate(started.token, {});

    // Presenting the already-rotated (revoked) token again is reuse.
    await expect(service.rotate(started.token, {})).rejects.toThrow(AppException);

    // Reuse must also revoke the *new* session issued by the first rotation,
    // not just re-reject the stale token.
    const survivingSessions = [...sessions.values()].filter((s) => !s.revokedAt);
    expect(survivingSessions).toHaveLength(0);
    await expect(service.rotate(firstRotation.token, {})).rejects.toThrow(AppException);
  });

  it('rejects an expired session', async () => {
    const { repo } = fakeSessionsRepository();
    const config = { auth: { jwtRefreshTtlSeconds: -1 } } as unknown as AppConfigService; // issues already-expired tokens
    const service = new RefreshSessionService(repo, config);

    const started = await service.startSession('user-1', {});
    await expect(service.rotate(started.token, {})).rejects.toThrow(AppException);
  });

  it('never stores the raw refresh token, only its hash', async () => {
    const { repo, sessions } = fakeSessionsRepository();
    const service = new RefreshSessionService(repo, fakeConfig());

    const started = await service.startSession('user-1', {});
    const [stored] = [...sessions.values()];
    expect(stored.refreshTokenHash).toBe(hashOpaqueToken(started.token));
    expect(stored.refreshTokenHash).not.toBe(started.token);
  });
});
