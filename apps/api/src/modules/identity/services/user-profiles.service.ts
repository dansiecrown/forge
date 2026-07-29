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

  async update(userId: string, input: UpdateUserProfileDto): Promise<UserProfileEntity> {
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
      actorUserId: userId,
    });
    return toUserProfileEntity(updated);
  }
}
