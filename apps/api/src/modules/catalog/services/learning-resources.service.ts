import { Injectable } from '@nestjs/common';
import type { LearningResourceType } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import {
  toLearningResourceEntity,
  type LearningResourceEntity,
} from '../entities/learning-resource.entity';
import type {
  CreateLearningResourceDto,
  UpdateLearningResourceDto,
} from '../dtos/learning-resource.dto';
import {
  LearningResourcesRepository,
  LearningResourceVersionConflictError,
} from '../repositories/learning-resources.repository';
import { LessonsService } from './lessons.service';
import { WeeklyModulesService } from './weekly-modules.service';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};

@Injectable()
export class LearningResourcesService {
  constructor(
    private readonly learningResourcesRepository: LearningResourcesRepository,
    private readonly weeklyModulesService: WeeklyModulesService,
    private readonly lessonsService: LessonsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    weeklyModuleId: string,
    options: { status?: string; q?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<LearningResourceEntity>> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.learningResourcesRepository.list(scope, {
      weeklyModuleId,
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toLearningResourceEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<LearningResourceEntity> {
    const resource = await this.learningResourcesRepository.findById(scope, id);
    if (!resource) {
      throw AppException.notFound('Learning resource not found.');
    }
    return toLearningResourceEntity(resource);
  }

  /** Existence + org-scope check for the `learning` module's acknowledgment
   * recording. */
  assertBelongsToScope(scope: TenantScope, resourceId: string): Promise<LearningResourceEntity> {
    return this.get(scope, resourceId);
  }

  private async assertLessonBelongsToModule(
    scope: TenantScope,
    weeklyModuleId: string,
    lessonId: string,
  ): Promise<void> {
    const lesson = await this.lessonsService.assertBelongsToScope(scope, lessonId);
    if (lesson.weeklyModuleId !== weeklyModuleId) {
      throw AppException.validation([
        {
          field: 'lessonId',
          code: 'LESSON_NOT_IN_MODULE',
          message: 'This lesson does not belong to the same weekly module.',
        },
      ]);
    }
  }

  async create(
    scope: TenantScope,
    weeklyModuleId: string,
    input: CreateLearningResourceDto,
    actorUserId?: string,
  ): Promise<LearningResourceEntity> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);
    if (input.lessonId) {
      await this.assertLessonBelongsToModule(scope, weeklyModuleId, input.lessonId);
    }

    const resource = await this.learningResourcesRepository.create(scope, {
      weeklyModuleId,
      lessonId: input.lessonId,
      resourceType: input.resourceType,
      url: input.url,
      title: input.title,
      author: input.author,
      provider: input.provider,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      isRequired: input.isRequired,
      notes: input.notes,
    });

    await this.auditLog.record({
      action: 'learning_resource.created',
      entityType: 'learning_resource',
      entityId: resource.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toLearningResourceEntity(resource);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateLearningResourceDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LearningResourceEntity> {
    const existing = await this.get(scope, id);
    if (input.lessonId) {
      await this.assertLessonBelongsToModule(scope, existing.weeklyModuleId, input.lessonId);
    }
    try {
      const updated = await this.learningResourcesRepository.update(
        scope,
        id,
        { ...input, resourceType: input.resourceType as LearningResourceType | undefined },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'learning_resource.updated',
        entityType: 'learning_resource',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toLearningResourceEntity(updated);
    } catch (error) {
      if (error instanceof LearningResourceVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Learning resource has moved to version ${error.currentVersion}.`,
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
  ): Promise<LearningResourceEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Learning resource cannot move from ${existing.status} to ${nextStatus}.`,
      );
    }
    try {
      const updated = await this.learningResourcesRepository.updateStatus(
        id,
        nextStatus,
        expectedVersion,
      );
      await this.auditLog.record({
        action: `learning_resource.${nextStatus}`,
        entityType: 'learning_resource',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toLearningResourceEntity(updated);
    } catch (error) {
      if (error instanceof LearningResourceVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Learning resource has moved to version ${error.currentVersion}.`,
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
  ): Promise<LearningResourceEntity> {
    return this.transition(scope, id, 'published', expectedVersion, actorUserId);
  }

  archive(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LearningResourceEntity> {
    return this.transition(scope, id, 'archived', expectedVersion, actorUserId);
  }

  async restore(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LearningResourceEntity> {
    const resource = await this.learningResourcesRepository.findByIdIncludingArchived(scope, id);
    if (!resource) {
      throw AppException.notFound('Learning resource not found.');
    }
    if (resource.version !== expectedVersion) {
      throw AppException.conflict(
        'VERSION_CONFLICT',
        `Learning resource has moved to version ${resource.version}.`,
      );
    }
    const updated = await this.learningResourcesRepository.restore(id);
    await this.auditLog.record({
      action: 'learning_resource.restored',
      entityType: 'learning_resource',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toLearningResourceEntity(updated);
  }

  async reorder(
    scope: TenantScope,
    weeklyModuleId: string,
    items: { id: string; displayOrder: number }[],
    actorUserId?: string,
  ): Promise<void> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);
    await this.learningResourcesRepository.reorder(scope, weeklyModuleId, items);
    await this.auditLog.record({
      action: 'learning_resource.reordered',
      entityType: 'weekly_module',
      entityId: weeklyModuleId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { items },
    });
  }
}
