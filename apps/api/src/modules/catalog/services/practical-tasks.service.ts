import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toPracticalTaskEntity, type PracticalTaskEntity } from '../entities/practical-task.entity';
import type { CreatePracticalTaskDto, UpdatePracticalTaskDto } from '../dtos/practical-task.dto';
import {
  PracticalTasksRepository,
  PracticalTaskVersionConflictError,
} from '../repositories/practical-tasks.repository';
import { WeeklyModulesService } from './weekly-modules.service';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};

@Injectable()
export class PracticalTasksService {
  constructor(
    private readonly practicalTasksRepository: PracticalTasksRepository,
    private readonly weeklyModulesService: WeeklyModulesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    weeklyModuleId: string,
    options: { status?: string; q?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<PracticalTaskEntity>> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.practicalTasksRepository.list(scope, {
      weeklyModuleId,
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toPracticalTaskEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<PracticalTaskEntity> {
    const task = await this.practicalTasksRepository.findById(scope, id);
    if (!task) {
      throw AppException.notFound('Practical task not found.');
    }
    return toPracticalTaskEntity(task);
  }

  /** Existence + org-scope check for the `learning` module's submission
   * recording. */
  assertBelongsToScope(scope: TenantScope, taskId: string): Promise<PracticalTaskEntity> {
    return this.get(scope, taskId);
  }

  async create(
    scope: TenantScope,
    weeklyModuleId: string,
    input: CreatePracticalTaskDto,
    actorUserId?: string,
  ): Promise<PracticalTaskEntity> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);

    const task = await this.practicalTasksRepository.create(scope, {
      weeklyModuleId,
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      deliverables: input.deliverables,
      submissionTypeMetadata: input.submissionTypeMetadata,
      dueOffsetDays: input.dueOffsetDays,
      rubricMetadata: input.rubricMetadata,
      maxScore: input.maxScore,
    });

    await this.auditLog.record({
      action: 'practical_task.created',
      entityType: 'practical_task',
      entityId: task.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toPracticalTaskEntity(task);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdatePracticalTaskDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<PracticalTaskEntity> {
    await this.get(scope, id);
    try {
      const updated = await this.practicalTasksRepository.update(
        scope,
        id,
        {
          ...input,
          submissionTypeMetadata: input.submissionTypeMetadata as Prisma.InputJsonValue,
          rubricMetadata: input.rubricMetadata as Prisma.InputJsonValue,
        },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'practical_task.updated',
        entityType: 'practical_task',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toPracticalTaskEntity(updated);
    } catch (error) {
      if (error instanceof PracticalTaskVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Practical task has moved to version ${error.currentVersion}.`,
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
  ): Promise<PracticalTaskEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Practical task cannot move from ${existing.status} to ${nextStatus}.`,
      );
    }
    try {
      const updated = await this.practicalTasksRepository.updateStatus(
        id,
        nextStatus,
        expectedVersion,
      );
      await this.auditLog.record({
        action: `practical_task.${nextStatus}`,
        entityType: 'practical_task',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toPracticalTaskEntity(updated);
    } catch (error) {
      if (error instanceof PracticalTaskVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Practical task has moved to version ${error.currentVersion}.`,
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
  ): Promise<PracticalTaskEntity> {
    return this.transition(scope, id, 'published', expectedVersion, actorUserId);
  }

  archive(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<PracticalTaskEntity> {
    return this.transition(scope, id, 'archived', expectedVersion, actorUserId);
  }

  async restore(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<PracticalTaskEntity> {
    const task = await this.practicalTasksRepository.findByIdIncludingArchived(scope, id);
    if (!task) {
      throw AppException.notFound('Practical task not found.');
    }
    if (task.version !== expectedVersion) {
      throw AppException.conflict(
        'VERSION_CONFLICT',
        `Practical task has moved to version ${task.version}.`,
      );
    }
    const updated = await this.practicalTasksRepository.restore(id);
    await this.auditLog.record({
      action: 'practical_task.restored',
      entityType: 'practical_task',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toPracticalTaskEntity(updated);
  }

  async reorder(
    scope: TenantScope,
    weeklyModuleId: string,
    items: { id: string; displayOrder: number }[],
    actorUserId?: string,
  ): Promise<void> {
    await this.weeklyModulesService.assertBelongsToScope(scope, weeklyModuleId);
    await this.practicalTasksRepository.reorder(scope, weeklyModuleId, items);
    await this.auditLog.record({
      action: 'practical_task.reordered',
      entityType: 'weekly_module',
      entityId: weeklyModuleId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { items },
    });
  }
}
