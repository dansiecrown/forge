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
  timezone?: string;
  locale?: string;
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

  async updateMe(userId: string, input: UpdateMeInput): Promise<User> {
    return this.usersRepository.update(userId, input);
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
   * exists in this milestone's scope — see Milestone 2 report). */
  async invite(email: string, displayName: string, invitedBy?: string): Promise<User> {
    const existing = await this.usersRepository.findByEmail(email);
    if (existing) {
      throw AppException.conflict('DUPLICATE', 'A user with this email already exists.');
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

    return user;
  }
}
