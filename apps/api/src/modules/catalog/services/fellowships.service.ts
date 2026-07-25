import { Injectable } from '@nestjs/common';
import { AcademiesService } from '../../organizations/services/academies.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toFellowshipEntity, type FellowshipEntity } from '../entities/fellowship.entity';
import type { CreateFellowshipDto, UpdateFellowshipDto } from '../dtos/fellowship.dto';
import {
  FellowshipsRepository,
  FellowshipVersionConflictError,
} from '../repositories/fellowships.repository';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['retired'],
  retired: [],
};

@Injectable()
export class FellowshipsService {
  constructor(
    private readonly fellowshipsRepository: FellowshipsRepository,
    private readonly academiesService: AcademiesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    options: { academyId?: string; status?: string; q?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<FellowshipEntity>> {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.fellowshipsRepository.list(scope, {
      academyId: options.academyId,
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toFellowshipEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<FellowshipEntity> {
    const fellowship = await this.fellowshipsRepository.findById(scope, id);
    if (!fellowship) {
      throw AppException.notFound('Fellowship not found.');
    }
    return toFellowshipEntity(fellowship);
  }

  /** Existence + org-scope check for the cohorts module validating a
   * caller-supplied fellowshipId — not exposed over HTTP. Also blocks
   * creating a Cohort under a retired Fellowship, per
   * docs/database-design.md's documented Fellowship lifecycle ("retire
   * prevents new cohort creation"). */
  async assertOpenForCohortCreation(
    scope: TenantScope,
    fellowshipId: string,
  ): Promise<FellowshipEntity> {
    const fellowship = await this.get(scope, fellowshipId);
    if (fellowship.status === 'retired') {
      throw AppException.conflict(
        'FELLOWSHIP_RETIRED',
        'This fellowship is retired and cannot accept new cohorts.',
      );
    }
    return fellowship;
  }

  async create(
    scope: TenantScope,
    input: CreateFellowshipDto,
    actorUserId?: string,
  ): Promise<FellowshipEntity> {
    await this.academiesService.assertBelongsToScope(scope, input.academyId);

    const existing = await this.fellowshipsRepository.findBySlug(
      scope,
      input.academyId,
      input.slug,
    );
    if (existing) {
      throw AppException.conflict(
        'SLUG_TAKEN',
        'This fellowship slug is already in use in this academy.',
      );
    }

    const fellowship = await this.fellowshipsRepository.create(scope, {
      academyId: input.academyId,
      title: input.title,
      slug: input.slug,
      durationWeeks: input.durationWeeks,
      summary: input.summary,
      description: input.description,
      defaultCapacity: input.defaultCapacity,
      isPublic: input.isPublic,
      registrationOpensAt: input.registrationOpensAt
        ? new Date(input.registrationOpensAt)
        : undefined,
      registrationClosesAt: input.registrationClosesAt
        ? new Date(input.registrationClosesAt)
        : undefined,
      eligibilityMetadata: input.eligibilityMetadata,
    });

    await this.auditLog.record({
      action: 'fellowship.created',
      entityType: 'fellowship',
      entityId: fellowship.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toFellowshipEntity(fellowship);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateFellowshipDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<FellowshipEntity> {
    const existing = await this.get(scope, id);
    if (existing.status === 'retired') {
      throw AppException.conflict('FELLOWSHIP_RETIRED', 'A retired fellowship cannot be edited.');
    }

    const data: Record<string, unknown> = { ...input };
    if (input.registrationOpensAt) data.registrationOpensAt = new Date(input.registrationOpensAt);
    if (input.registrationClosesAt)
      data.registrationClosesAt = new Date(input.registrationClosesAt);

    try {
      const updated = await this.fellowshipsRepository.update(scope, id, data, expectedVersion);
      await this.auditLog.record({
        action: 'fellowship.updated',
        entityType: 'fellowship',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toFellowshipEntity(updated);
    } catch (error) {
      if (error instanceof FellowshipVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Fellowship has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  private async transition(
    scope: TenantScope,
    id: string,
    nextStatus: 'published' | 'retired',
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<FellowshipEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Fellowship cannot move from ${existing.status} to ${nextStatus}.`,
      );
    }
    try {
      const updated = await this.fellowshipsRepository.updateStatus(
        id,
        nextStatus,
        expectedVersion,
      );
      await this.auditLog.record({
        action: `fellowship.${nextStatus}`,
        entityType: 'fellowship',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toFellowshipEntity(updated);
    } catch (error) {
      if (error instanceof FellowshipVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Fellowship has moved to version ${error.currentVersion}.`,
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
  ): Promise<FellowshipEntity> {
    return this.transition(scope, id, 'published', expectedVersion, actorUserId);
  }

  retire(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<FellowshipEntity> {
    return this.transition(scope, id, 'retired', expectedVersion, actorUserId);
  }
}
