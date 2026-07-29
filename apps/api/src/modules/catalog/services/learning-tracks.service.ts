import { Injectable } from '@nestjs/common';
import type { Prisma, TrackDifficulty } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toLearningTrackEntity, type LearningTrackEntity } from '../entities/learning-track.entity';
import type { CreateLearningTrackDto, UpdateLearningTrackDto } from '../dtos/learning-track.dto';
import {
  LearningTracksRepository,
  LearningTrackVersionConflictError,
} from '../repositories/learning-tracks.repository';
import { FellowshipsService } from './fellowships.service';

// draft -> published -> archived. Archive is also reachable directly from
// draft (an in-progress track can be abandoned without ever publishing).
// Restore always returns to draft — republishing is an explicit follow-up
// action, never implicit.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};

@Injectable()
export class LearningTracksService {
  constructor(
    private readonly learningTracksRepository: LearningTracksRepository,
    private readonly fellowshipsService: FellowshipsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    fellowshipId: string,
    options: { status?: string; q?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<LearningTrackEntity>> {
    await this.fellowshipsService.get(scope, fellowshipId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.learningTracksRepository.list(scope, {
      fellowshipId,
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toLearningTrackEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<LearningTrackEntity> {
    const track = await this.learningTracksRepository.findById(scope, id);
    if (!track) {
      throw AppException.notFound('Learning track not found.');
    }
    return toLearningTrackEntity(track);
  }

  /** Existence + org-scope check for the `courses` service — not exposed
   * over HTTP, mirrors AcademiesService.assertBelongsToScope. */
  assertBelongsToScope(scope: TenantScope, trackId: string): Promise<LearningTrackEntity> {
    return this.get(scope, trackId);
  }

  async create(
    scope: TenantScope,
    fellowshipId: string,
    input: CreateLearningTrackDto,
    actorUserId?: string,
  ): Promise<LearningTrackEntity> {
    await this.fellowshipsService.get(scope, fellowshipId);

    const existing = await this.learningTracksRepository.findBySlug(
      scope,
      fellowshipId,
      input.slug,
    );
    if (existing) {
      throw AppException.conflict(
        'SLUG_TAKEN',
        'This learning track slug is already in use in this fellowship.',
      );
    }

    const track = await this.learningTracksRepository.create(scope, {
      fellowshipId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      iconMetadata: input.iconMetadata,
      difficulty: input.difficulty,
      estimatedWeeks: input.estimatedWeeks,
      prerequisitesMetadata: input.prerequisitesMetadata,
      learningOutcomes: input.learningOutcomes,
      tags: input.tags,
    });

    await this.auditLog.record({
      action: 'learning_track.created',
      entityType: 'learning_track',
      entityId: track.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toLearningTrackEntity(track);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateLearningTrackDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LearningTrackEntity> {
    await this.get(scope, id);
    try {
      const updated = await this.learningTracksRepository.update(
        scope,
        id,
        {
          ...input,
          difficulty: input.difficulty as TrackDifficulty | undefined,
          iconMetadata: input.iconMetadata as Prisma.InputJsonValue,
          prerequisitesMetadata: input.prerequisitesMetadata as Prisma.InputJsonValue,
        },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'learning_track.updated',
        entityType: 'learning_track',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toLearningTrackEntity(updated);
    } catch (error) {
      if (error instanceof LearningTrackVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Learning track has moved to version ${error.currentVersion}.`,
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
  ): Promise<LearningTrackEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Learning track cannot move from ${existing.status} to ${nextStatus}.`,
      );
    }
    try {
      const updated = await this.learningTracksRepository.updateStatus(
        id,
        nextStatus,
        expectedVersion,
      );
      await this.auditLog.record({
        action: `learning_track.${nextStatus}`,
        entityType: 'learning_track',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toLearningTrackEntity(updated);
    } catch (error) {
      if (error instanceof LearningTrackVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Learning track has moved to version ${error.currentVersion}.`,
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
  ): Promise<LearningTrackEntity> {
    return this.transition(scope, id, 'published', expectedVersion, actorUserId);
  }

  async archive(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LearningTrackEntity> {
    return this.transition(scope, id, 'archived', expectedVersion, actorUserId);
  }

  async restore(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<LearningTrackEntity> {
    const track = await this.learningTracksRepository.findByIdIncludingArchived(scope, id);
    if (!track) {
      throw AppException.notFound('Learning track not found.');
    }
    if (track.version !== expectedVersion) {
      throw AppException.conflict(
        'VERSION_CONFLICT',
        `Learning track has moved to version ${track.version}.`,
      );
    }
    const updated = await this.learningTracksRepository.restore(id);
    await this.auditLog.record({
      action: 'learning_track.restored',
      entityType: 'learning_track',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toLearningTrackEntity(updated);
  }

  async reorder(
    scope: TenantScope,
    fellowshipId: string,
    items: { id: string; displayOrder: number }[],
    actorUserId?: string,
  ): Promise<void> {
    await this.fellowshipsService.get(scope, fellowshipId);
    await this.learningTracksRepository.reorder(scope, fellowshipId, items);
    await this.auditLog.record({
      action: 'learning_track.reordered',
      entityType: 'fellowship',
      entityId: fellowshipId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { items },
    });
  }
}
