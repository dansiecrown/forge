import { Injectable } from '@nestjs/common';
import type { LessonType, Prisma } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toLessonEntity, type LessonEntity } from '../entities/lesson.entity';
import type { CreateLessonDto, UpdateLessonDto } from '../dtos/lesson.dto';
import { LessonsRepository, LessonVersionConflictError } from '../repositories/lessons.repository';
import { WeeklyModulesService } from './weekly-modules.service';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};

@Injectable()
export class LessonsService {
  constructor(
    private readonly lessonsRepository: LessonsRepository,
    private readonly weeklyModulesService: WeeklyModulesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    weeklyModuleId: string,
    options: { status?: string; q?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<LessonEntity>> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.lessonsRepository.list(scope, {
      weeklyModuleId,
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toLessonEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<LessonEntity> {
    const lesson = await this.lessonsRepository.findById(scope, id);
    if (!lesson) {
      throw AppException.notFound('Lesson not found.');
    }
    return toLessonEntity(lesson);
  }

  /** Existence + org-scope check for the `learning` module's completion
   * recording and the `learning-resources` service's optional lesson link. */
  assertBelongsToScope(scope: TenantScope, lessonId: string): Promise<LessonEntity> {
    return this.get(scope, lessonId);
  }

  async create(
    scope: TenantScope,
    weeklyModuleId: string,
    input: CreateLessonDto,
    actorUserId?: string,
  ): Promise<LessonEntity> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);

    const lesson = await this.lessonsRepository.create(scope, {
      weeklyModuleId,
      title: input.title,
      description: input.description,
      lessonType: input.lessonType,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      resourceUrl: input.resourceUrl,
      attachmentMetadata: input.attachmentMetadata,
      embeddedContentMetadata: input.embeddedContentMetadata,
      completionRequired: input.completionRequired,
    });

    await this.auditLog.record({
      action: 'lesson.created',
      entityType: 'lesson',
      entityId: lesson.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toLessonEntity(lesson);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateLessonDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LessonEntity> {
    await this.get(scope, id);
    try {
      const updated = await this.lessonsRepository.update(
        scope,
        id,
        {
          ...input,
          lessonType: input.lessonType as LessonType | undefined,
          attachmentMetadata: input.attachmentMetadata as Prisma.InputJsonValue,
          embeddedContentMetadata: input.embeddedContentMetadata as Prisma.InputJsonValue,
        },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'lesson.updated',
        entityType: 'lesson',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toLessonEntity(updated);
    } catch (error) {
      if (error instanceof LessonVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Lesson has moved to version ${error.currentVersion}.`,
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
  ): Promise<LessonEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Lesson cannot move from ${existing.status} to ${nextStatus}.`,
      );
    }
    try {
      const updated = await this.lessonsRepository.updateStatus(id, nextStatus, expectedVersion);
      await this.auditLog.record({
        action: `lesson.${nextStatus}`,
        entityType: 'lesson',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toLessonEntity(updated);
    } catch (error) {
      if (error instanceof LessonVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Lesson has moved to version ${error.currentVersion}.`,
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
  ): Promise<LessonEntity> {
    return this.transition(scope, id, 'published', expectedVersion, actorUserId);
  }

  archive(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LessonEntity> {
    return this.transition(scope, id, 'archived', expectedVersion, actorUserId);
  }

  async restore(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LessonEntity> {
    const lesson = await this.lessonsRepository.findByIdIncludingArchived(scope, id);
    if (!lesson) {
      throw AppException.notFound('Lesson not found.');
    }
    if (lesson.version !== expectedVersion) {
      throw AppException.conflict(
        'VERSION_CONFLICT',
        `Lesson has moved to version ${lesson.version}.`,
      );
    }
    const updated = await this.lessonsRepository.restore(id);
    await this.auditLog.record({
      action: 'lesson.restored',
      entityType: 'lesson',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toLessonEntity(updated);
  }

  async reorder(
    scope: TenantScope,
    weeklyModuleId: string,
    items: { id: string; displayOrder: number }[],
    actorUserId?: string,
  ): Promise<void> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);
    await this.lessonsRepository.reorder(scope, weeklyModuleId, items);
    await this.auditLog.record({
      action: 'lesson.reordered',
      entityType: 'weekly_module',
      entityId: weeklyModuleId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { items },
    });
  }
}
