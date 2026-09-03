import { Inject, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AppConfigService } from '../../../config/app-config.service';
import { generateOpaqueToken, hashOpaqueToken } from '../../../shared/crypto/opaque-token';
import { EMAIL_ADAPTER, type EmailAdapter } from '../../../shared/email/email-adapter';
import { AppException } from '../../../shared/errors/app.exception';
import type { CollectionResult } from '../../../shared/pagination/collection-result';
import { AuditLogService } from '../../platform/audit-log.service';
import { PasswordResetTokensRepository } from '../repositories/verification-tokens.repository';
import { UsersRepository } from '../repositories/users.repository';

export interface UpdateMeInput {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  timezone?: string;
  locale?: string;
}

export interface InviteResult {
  user: User;
  /** False when an existing platform identity was reused for a second
   * organization's invitation — no new credential/email is issued for
   * that case. See docs/adr/0003 Part A addendum. */
  isNewUser: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordResetTokensRepository: PasswordResetTokensRepository,
    private readonly auditLog: AuditLogService,
    private readonly config: AppConfigService,
    @Inject(EMAIL_ADAPTER) private readonly emailAdapter: EmailAdapter,
  ) {}

  async getById(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw AppException.notFound('User not found.');
    }
    return user;
  }

  listByIds(ids: string[]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  async updateMe(userId: string, input: UpdateMeInput): Promise<User> {
    return this.usersRepository.update(userId, input);
  }

  /** Admin-scoped account status change (suspend/reactivate) — distinct from
   * `Membership.status`, which governs a user's standing within one
   * organization. See docs/adr/0009-administration-platform.md. */
  async updateStatus(userId: string, status: 'active' | 'suspended'): Promise<User> {
    await this.getById(userId);
    return this.usersRepository.update(userId, { status });
  }

  /** Admin-forced password reset — reuses the exact token-based reset-link
   * mechanism `AuthService.forgotPassword` already uses (no new
   * "must-reset-password" login-blocking gate; that would touch already-
   * tested login flow, a materially riskier change than this milestone's
   * scope — see docs/adr/0009-administration-platform.md Decision 5's
   * sibling narrowing). Session revocation is the caller's responsibility
   * (see `AdminUsersService.forcePasswordReset`), so the old password can't
   * keep a session alive after the reset link is issued. */
  async forcePasswordReset(userId: string): Promise<void> {
    const user = await this.getById(userId);
    const token = generateOpaqueToken(32);
    const expiresAt = new Date(Date.now() + this.config.auth.passwordResetTokenTtlMinutes * 60_000);
    await this.passwordResetTokensRepository.create(user.id, hashOpaqueToken(token), expiresAt);
    await this.emailAdapter.send({
      to: user.emailCanonical,
      subject: 'Your Project Forge password must be reset',
      templateKey: 'password-reset',
      variables: { token, displayName: user.displayName },
    });
  }

  list(
    cursor: string | undefined,
    limit: number,
    q: string | undefined,
  ): Promise<CollectionResult<User>> {
    return this.usersRepository.list({ cursor, limit, q });
  }

  /** Creates the invited user record and issues a set-password link reusing
   * the password-reset token flow (no separate accept-invitation endpoint
   * exists in this milestone's scope — see Milestone 2 report).
   *
   * Identity is global and Membership is per-organization (docs/database-
   * design.md: "one user can be a student in several organizations"), so an
   * email that already exists anywhere on the platform is not an error here
   * — that identity is reused for the new organization's membership instead
   * of being rejected or duplicated. The caller (UsersController) still
   * creates the membership itself via MembershipsService either way; no new
   * credential or "set your password" email is issued for an existing
   * identity, since one already exists. See docs/adr/0003 Part A addendum. */
  async invite(email: string, displayName: string, invitedBy?: string): Promise<InviteResult> {
    const existing = await this.usersRepository.findByEmail(email);
    if (existing) {
      return { user: existing, isNewUser: false };
    }

    const user = await this.usersRepository.create({ emailCanonical: email, displayName });

    const token = generateOpaqueToken(32);
    const expiresAt = new Date(Date.now() + this.config.auth.passwordResetTokenTtlMinutes * 60_000);
    await this.passwordResetTokensRepository.create(user.id, hashOpaqueToken(token), expiresAt);
    await this.emailAdapter.send({
      to: user.emailCanonical,
      subject: "You're invited to Project Forge",
      templateKey: 'invitation',
      variables: { token, displayName: user.displayName },
    });

    await this.auditLog.record({
      action: 'membership.invite',
      entityType: 'user',
      entityId: user.id,
      outcome: 'success',
      actorUserId: invitedBy,
    });

    return { user, isNewUser: true };
  }
}
