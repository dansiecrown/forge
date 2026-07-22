import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { generateOpaqueToken, hashOpaqueToken } from '../../../shared/crypto/opaque-token';
import { AppException } from '../../../shared/errors/app.exception';
import { AuthSessionsRepository } from '../repositories/auth-sessions.repository';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
  userId: string;
}

export interface DeviceContext {
  deviceLabel?: string;
  ipHash?: string;
}

/** Rotating refresh-token sessions per docs/system-architecture.md §6:
 * each refresh rotates the token and keeps a family lineage; reuse of an
 * already-rotated token revokes the whole family (theft response). */
@Injectable()
export class RefreshSessionService {
  private readonly logger = new Logger(RefreshSessionService.name);

  constructor(
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly config: AppConfigService,
  ) {}

  async startSession(
    userId: string,
    device: DeviceContext,
    mfaVerifiedAt?: Date,
  ): Promise<IssuedRefreshToken> {
    const familyId = randomUUID();
    return this.issue(userId, familyId, device, mfaVerifiedAt);
  }

  /** Verifies and rotates a refresh token. Throws on expiry/revocation; if
   * the token was already rotated (reuse), the entire family is revoked. */
  async rotate(presentedToken: string, device: DeviceContext): Promise<IssuedRefreshToken> {
    const tokenHash = hashOpaqueToken(presentedToken);
    const session = await this.authSessionsRepository.findByRefreshTokenHash(tokenHash);
    if (!session) {
      throw AppException.unauthenticated('Session not found.', 'SESSION_REVOKED');
    }

    if (session.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for family ${session.familyId}; revoking family.`,
      );
      await this.authSessionsRepository.revokeFamily(session.familyId);
      throw AppException.unauthenticated('Session has been revoked.', 'SESSION_REVOKED');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw AppException.unauthenticated('Session has expired.', 'TOKEN_EXPIRED');
    }

    const issued = await this.issue(
      session.userId,
      session.familyId,
      device,
      session.mfaVerifiedAt ?? undefined,
    );
    await this.authSessionsRepository.revoke(session.id);
    return issued;
  }

  async revokeByToken(presentedToken: string): Promise<void> {
    const tokenHash = hashOpaqueToken(presentedToken);
    const session = await this.authSessionsRepository.findByRefreshTokenHash(tokenHash);
    if (session && !session.revokedAt) {
      await this.authSessionsRepository.revoke(session.id);
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.authSessionsRepository.revokeAllForUser(userId);
  }

  private async issue(
    userId: string,
    familyId: string,
    device: DeviceContext,
    mfaVerifiedAt?: Date,
  ): Promise<IssuedRefreshToken> {
    const token = generateOpaqueToken(32);
    const expiresAt = new Date(Date.now() + this.config.auth.jwtRefreshTtlSeconds * 1000);
    await this.authSessionsRepository.create({
      userId,
      familyId,
      refreshTokenHash: hashOpaqueToken(token),
      expiresAt,
      deviceLabel: device.deviceLabel,
      ipHash: device.ipHash,
      mfaVerifiedAt,
    });
    return { token, expiresAt, userId };
  }
}
