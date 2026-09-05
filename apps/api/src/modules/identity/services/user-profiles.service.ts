import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import {
  EMPTY_USER_PROFILE,
  toUserProfileEntity,
  type UserProfileEntity,
} from '../entities/user-profile.entity';
import type { UpdateUserProfileDto } from '../dtos/user-profile.dto';
import { UserProfilesRepository } from '../repositories/user-profiles.repository';

@Injectable()
export class UserProfilesService {
  constructor(
    private readonly userProfilesRepository: UserProfilesRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async get(userId: string): Promise<UserProfileEntity> {
    const row = await this.userProfilesRepository.findByUserId(userId);
    return row ? toUserProfileEntity(row) : EMPTY_USER_PROFILE;
  }

  /** `actorUserId` defaults to `userId` (the self-service `/me/profile`
   * path — a user editing their own profile). An admin editing someone
   * else's profile (Admin Users profile editing) passes their own id
   * explicitly so the audit trail attributes the edit correctly rather than
   * misattributing it to the profile owner. */
  async update(
    userId: string,
    input: UpdateUserProfileDto,
    actorUserId: string = userId,
  ): Promise<UserProfileEntity> {
    const updated = await this.userProfilesRepository.upsert(userId, {
      ...input,
      learningPreferencesMetadata: input.learningPreferencesMetadata as
        Prisma.InputJsonValue | undefined,
    });
    await this.auditLog.record({
      action: 'user_profile.updated',
      entityType: 'user_profile',
      entityId: updated.id,
      outcome: 'success',
      actorUserId,
    });
    return toUserProfileEntity(updated);
  }
}
