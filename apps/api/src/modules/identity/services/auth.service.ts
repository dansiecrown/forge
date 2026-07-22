import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AppConfigService } from '../../../config/app-config.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { generateOpaqueToken, hashOpaqueToken } from '../../../shared/crypto/opaque-token';
import { EMAIL_ADAPTER, type EmailAdapter } from '../../../shared/email/email-adapter';
import { AppException } from '../../../shared/errors/app.exception';
import { PasswordCredentialsRepository } from '../repositories/password-credentials.repository';
import {
  EmailVerificationTokensRepository,
  PasswordResetTokensRepository,
} from '../repositories/verification-tokens.repository';
import { UsersRepository } from '../repositories/users.repository';
import { AccessTokenService, type IssuedAccessToken } from './access-token.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { type DeviceContext, RefreshSessionService } from './refresh-session.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface LoginResult {
  accessToken?: string;
  expiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  user?: PublicUser;
  mfaRequired: boolean;
  mfaChallengeToken?: string;
}

export interface PublicUser {
  id: string;
  displayName: string;
  email: string;
  status: string;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.emailCanonical,
    status: user.status,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordCredentialsRepository: PasswordCredentialsRepository,
    private readonly passwordResetTokensRepository: PasswordResetTokensRepository,
    private readonly emailVerificationTokensRepository: EmailVerificationTokensRepository,
    private readonly passwordService: PasswordService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshSessionService: RefreshSessionService,
    private readonly mfaService: MfaService,
    private readonly auditLog: AuditLogService,
    private readonly config: AppConfigService,
    @Inject(EMAIL_ADAPTER) private readonly emailAdapter: EmailAdapter,
  ) {}

  async login(
    email: string,
    password: string,
    device: DeviceContext,
    requestId?: string,
  ): Promise<LoginResult> {
    const user = await this.usersRepository.findByEmail(email);
    const credential = user ? await this.passwordCredentialsRepository.findByUserId(user.id) : null;

    if (!user || !credential) {
      throw AppException.invalidCredentials();
    }

    if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
      throw AppException.invalidCredentials();
    }

    if (user.status !== 'active') {
      await this.auditLog.record({
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        outcome: 'failure',
        requestId,
        metadata: { reason: 'account_not_active' },
      });
      throw AppException.invalidCredentials();
    }

    const passwordValid = await this.passwordService.verify(credential.passwordHash, password);
    if (!passwordValid) {
      await this.registerFailedAttempt(user.id, credential.failedAttempts);
      await this.auditLog.record({
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        outcome: 'failure',
        requestId,
        metadata: { reason: 'invalid_password' },
      });
      throw AppException.invalidCredentials();
    }

    await this.passwordCredentialsRepository.resetFailedAttempts(user.id);
    await this.usersRepository.update(user.id, { lastLoginAt: new Date() });

    const mfaEnabled = await this.mfaService.isEnabled(user.id);
    if (mfaEnabled) {
      return {
        mfaRequired: true,
        mfaChallengeToken: this.accessTokenService.issueMfaChallenge(user.id),
      };
    }

    await this.auditLog.record({
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      outcome: 'success',
      requestId,
    });

    return this.issueSession(user, device);
  }

  async completeMfaLogin(
    challengeToken: string,
    code: string,
    device: DeviceContext,
  ): Promise<LoginResult> {
    const { sub: userId } = this.accessTokenService.verifyMfaChallenge(challengeToken);
    const verified = await this.mfaService.verifyChallenge(userId, code);
    if (!verified) {
      throw AppException.unauthenticated('The verification code is invalid.', 'INVALID_MFA_CODE');
    }

    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw AppException.unauthenticated();
    }

    return this.issueSession(user, device, new Date());
  }

  /** Single endpoint, two callers per the API spec: an already-authenticated
   * user finishing MFA enrollment (Authorization carries a full access
   * token + `factorId`), or a signing-in user completing a login challenge
   * (Authorization carries the short-lived challenge token from `login()`). */
  async verifyMfaEndpoint(
    authorizationToken: string,
    code: string,
    factorId: string | undefined,
    device: DeviceContext,
  ): Promise<{ accessToken: string; expiresIn: number; mfaVerified: true } | LoginResult> {
    const tokenType = this.accessTokenService.peekType(authorizationToken);

    if (tokenType === 'access') {
      const { sub: userId } = this.accessTokenService.verify(authorizationToken);
      if (!factorId) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'INVALID_REQUEST',
          'factorId is required to verify enrollment.',
        );
      }
      await this.mfaService.verifyEnrollment(userId, factorId, code);
      const issued = this.accessTokenService.issue(userId);
      return { accessToken: issued.token, expiresIn: issued.expiresIn, mfaVerified: true };
    }

    if (tokenType === 'mfa_challenge') {
      return this.completeMfaLogin(authorizationToken, code, device);
    }

    throw AppException.unauthenticated();
  }

  async refresh(
    presentedRefreshToken: string,
    device: DeviceContext,
  ): Promise<IssuedAccessToken & { refreshToken: string; refreshTokenExpiresAt: Date }> {
    const rotated = await this.refreshSessionService.rotate(presentedRefreshToken, device);
    const accessToken = this.accessTokenService.issue(rotated.userId);
    return {
      ...accessToken,
      refreshToken: rotated.token,
      refreshTokenExpiresAt: rotated.expiresAt,
    };
  }

  async logout(
    presentedRefreshToken: string | undefined,
    userId: string | undefined,
    allSessions: boolean,
  ): Promise<void> {
    if (allSessions && userId) {
      await this.refreshSessionService.revokeAllForUser(userId);
      return;
    }
    if (presentedRefreshToken) {
      await this.refreshSessionService.revokeByToken(presentedRefreshToken);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      return; // Non-enumerating: caller always sees the same generic response.
    }

    const token = generateOpaqueToken(32);
    const expiresAt = new Date(Date.now() + this.config.auth.passwordResetTokenTtlMinutes * 60_000);
    await this.passwordResetTokensRepository.create(user.id, hashOpaqueToken(token), expiresAt);

    await this.emailAdapter.send({
      to: user.emailCanonical,
      subject: 'Reset your Project Forge password',
      templateKey: 'password-reset',
      variables: { token, displayName: user.displayName },
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.passwordResetTokensRepository.findByTokenHash(hashOpaqueToken(token));
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_TOKEN',
        'This reset link is invalid or has expired.',
      );
    }

    const hash = await this.passwordService.hash(newPassword);
    await this.passwordCredentialsRepository.updateHash(record.userId, hash);
    await this.passwordResetTokensRepository.markUsed(record.id);
    await this.refreshSessionService.revokeAllForUser(record.userId);
    await this.auditLog.record({
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: record.userId,
      outcome: 'success',
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const credential = await this.passwordCredentialsRepository.findByUserId(userId);
    if (
      !credential ||
      !(await this.passwordService.verify(credential.passwordHash, currentPassword))
    ) {
      throw AppException.unauthenticated('Current password is incorrect.', 'REAUTH_REQUIRED');
    }

    const hash = await this.passwordService.hash(newPassword);
    await this.passwordCredentialsRepository.updateHash(userId, hash);
    await this.refreshSessionService.revokeAllForUser(userId);
    await this.auditLog.record({
      action: 'auth.password_change',
      entityType: 'user',
      entityId: userId,
      outcome: 'success',
    });
  }

  async sendVerificationEmail(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user || user.emailVerifiedAt) {
      return; // Non-enumerating.
    }

    const token = generateOpaqueToken(32);
    const expiresAt = new Date(
      Date.now() + this.config.auth.emailVerificationTokenTtlHours * 3_600_000,
    );
    await this.emailVerificationTokensRepository.create(user.id, hashOpaqueToken(token), expiresAt);
    await this.emailAdapter.send({
      to: user.emailCanonical,
      subject: 'Verify your Project Forge email',
      templateKey: 'email-verification',
      variables: { token, displayName: user.displayName },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.emailVerificationTokensRepository.findByTokenHash(
      hashOpaqueToken(token),
    );
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_TOKEN',
        'This verification link is invalid or has expired.',
      );
    }

    await this.usersRepository.update(record.userId, { emailVerifiedAt: new Date() });
    await this.emailVerificationTokensRepository.markUsed(record.id);
  }

  private async issueSession(
    user: User,
    device: DeviceContext,
    mfaVerifiedAt?: Date,
  ): Promise<LoginResult> {
    const accessToken = this.accessTokenService.issue(user.id);
    const refresh = await this.refreshSessionService.startSession(user.id, device, mfaVerifiedAt);
    return {
      accessToken: accessToken.token,
      expiresIn: accessToken.expiresIn,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
      user: toPublicUser(user),
      mfaRequired: false,
    };
  }

  private async registerFailedAttempt(userId: string, currentAttempts: number): Promise<void> {
    const attempts = currentAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
    await this.passwordCredentialsRepository.recordFailedAttempt(userId, attempts, lockedUntil);
  }
}
