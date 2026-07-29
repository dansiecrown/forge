import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toWeeklyModuleEntity, type WeeklyModuleEntity } from '../entities/weekly-module.entity';
import type { CreateWeeklyModuleDto, UpdateWeeklyModuleDto } from '../dtos/weekly-module.dto';
import {
  WeeklyModulesRepository,
  WeeklyModuleVersionConflictError,
} from '../repositories/weekly-modules.repository';
import { CoursesService } from './courses.service';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};

@Injectable()
export class WeeklyModulesService {
  constructor(
    private readonly weeklyModulesRepository: WeeklyModulesRepository,
    private readonly coursesService: CoursesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    courseId: string,
    options: { status?: string; q?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<WeeklyModuleEntity>> {
    await this.coursesService.assertBelongsToScope(scope, courseId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.weeklyModulesRepository.list(scope, {
      courseId,
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toWeeklyModuleEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<WeeklyModuleEntity> {
    const module_ = await this.weeklyModulesRepository.findById(scope, id);
    if (!module_) {
      throw AppException.notFound('Weekly module not found.');
    }
    return toWeeklyModuleEntity(module_);
  }

  /** Existence + org-scope check for the `lessons`/`learning-resources`/
   * `practical-tasks` services. */
  assertBelongsToScope(scope: TenantScope, moduleId: string): Promise<WeeklyModuleEntity> {
    return this.get(scope, moduleId);
  }

  async create(
    scope: TenantScope,
    courseId: string,
    input: CreateWeeklyModuleDto,
    actorUserId?: string,
  ): Promise<WeeklyModuleEntity> {
    await this.coursesService.assertBelongsToScope(scope, courseId);

    const existing = await this.weeklyModulesRepository.findByWeekNumber(
      scope,
      courseId,
      input.weekNumber,
    );
    if (existing) {
      throw AppException.conflict(
        'WEEK_NUMBER_TAKEN',
        'This week number is already in use in this course.',
      );
    }

    const module_ = await this.weeklyModulesRepository.create(scope, {
      courseId,
      weekNumber: input.weekNumber,
      title: input.title,
      objectives: input.objectives,
      summary: input.summary,
      estimatedStudyHours: input.estimatedStudyHours,
      requiresMentorHuddle: input.requiresMentorHuddle,
      requiresPracticalWork: input.requiresPracticalWork,
      unlockRules: input.unlockRules,
      huddleScheduleMetadata: input.huddleScheduleMetadata,
      huddleMeetingLink: input.huddleMeetingLink,
      mentorHuddleNotes: input.mentorHuddleNotes,
      huddleAttendanceRequired: input.huddleAttendanceRequired,
    });

    await this.auditLog.record({
      action: 'weekly_module.created',
      entityType: 'weekly_module',
      entityId: module_.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toWeeklyModuleEntity(module_);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateWeeklyModuleDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<WeeklyModuleEntity> {
    const existing = await this.get(scope, id);

    if (input.weekNumber && input.weekNumber !== existing.weekNumber) {
      const conflict = await this.weeklyModulesRepository.findByWeekNumber(
        scope,
        existing.courseId,
        input.weekNumber,
      );
      if (conflict) {
        throw AppException.conflict(
          'WEEK_NUMBER_TAKEN',
          'This week number is already in use in this course.',
        );
      }
    }

    try {
      const updated = await this.weeklyModulesRepository.update(
        scope,
        id,
        {
          ...input,
          unlockRules: input.unlockRules as Prisma.InputJsonValue,
          huddleScheduleMetadata: input.huddleScheduleMetadata as Prisma.InputJsonValue,
        },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'weekly_module.updated',
        entityType: 'weekly_module',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toWeeklyModuleEntity(updated);
    } catch (error) {
      if (error instanceof WeeklyModuleVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Weekly module has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  private async transition(
    scope: TenantScope,
    id: string,
    nextStatus: 'published' | 'archived',
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<WeeklyModuleEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Weekly module cannot move from ${existing.status} to ${nextStatus}.`,
      );
    }
    try {
      const updated = await this.weeklyModulesRepository.updateStatus(
        id,
        nextStatus,
        expectedVersion,
      );
      await this.auditLog.record({
        action: `weekly_module.${nextStatus}`,
        entityType: 'weekly_module',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toWeeklyModuleEntity(updated);
    } catch (error) {
      if (error instanceof WeeklyModuleVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Weekly module has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  publish(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<WeeklyModuleEntity> {
    return this.transition(scope, id, 'published', expectedVersion, actorUserId);
  }

  archive(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<WeeklyModuleEntity> {
    return this.transition(scope, id, 'archived', expectedVersion, actorUserId);
  }

  async restore(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<WeeklyModuleEntity> {
    const module_ = await this.weeklyModulesRepository.findByIdIncludingArchived(scope, id);
    if (!module_) {
      throw AppException.notFound('Weekly module not found.');
    }
    if (module_.version !== expectedVersion) {
      throw AppException.conflict(
        'VERSION_CONFLICT',
        `Weekly module has moved to version ${module_.version}.`,
      );
    }
    const updated = await this.weeklyModulesRepository.restore(id);
    await this.auditLog.record({
      action: 'weekly_module.restored',
      entityType: 'weekly_module',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toWeeklyModuleEntity(updated);
  }
}
