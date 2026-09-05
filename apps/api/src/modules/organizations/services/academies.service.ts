import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toAcademyEntity, type AcademyEntity } from '../entities/academy.entity';
import type { CreateAcademyDto, UpdateAcademyDto } from '../dtos/academy.dto';
import {
  AcademiesRepository,
  AcademyVersionConflictError,
} from '../repositories/academies.repository';
import { MembershipsService } from './memberships.service';

@Injectable()
export class AcademiesService {
  constructor(
    private readonly academiesRepository: AcademiesRepository,
    private readonly auditLog: AuditLogService,
    private readonly membershipsService: MembershipsService,
  ) {}

  /** Milestone 7 hierarchy scoping (closes DEBT-015): an Academy Admin's
   * view is confined to the single Academy their membership is anchored to;
   * Super Admin and Org Admin see the whole organization. `callerId` is
   * required for every caller-facing read/write — internal callers that
   * legitimately have no caller context (none exist today) must not reuse
   * this method. */
  private async resolveAcademyScope(scope: TenantScope, callerId: string) {
    return this.membershipsService.getAcademyScope(scope, callerId);
  }

  async list(
    scope: TenantScope,
    options: { status?: string; q?: string; cursor?: string; limit?: string },
    callerId: string,
  ): Promise<CollectionResult<AcademyEntity>> {
    const limit = parseLimit(options.limit);
    const academyScope = await this.resolveAcademyScope(scope, callerId);
    if (academyScope.restricted && !academyScope.academyId) {
      return new CollectionResult([], {
        nextCursor: null,
        previousCursor: options.cursor ?? null,
        limit,
        hasMore: false,
      });
    }

    const { rows, hasMore } = await this.academiesRepository.list(scope, {
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
      restrictToId: academyScope.restricted ? (academyScope.academyId as string) : undefined,
    });
    return new CollectionResult(rows.map(toAcademyEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string, callerId: string): Promise<AcademyEntity> {
    const academy = await this.academiesRepository.findById(scope, id);
    if (!academy) {
      throw AppException.notFound('Academy not found.');
    }
    const academyScope = await this.resolveAcademyScope(scope, callerId);
    if (academyScope.restricted && academyScope.academyId !== id) {
      throw AppException.notFound('Academy not found.');
    }
    return toAcademyEntity(academy);
  }

  /** Existence + org/academy-scope check only, for other modules (catalog,
   * cohorts) validating a caller-supplied academyId — not exposed over HTTP. */
  async assertBelongsToScope(
    scope: TenantScope,
    academyId: string,
    callerId: string,
  ): Promise<AcademyEntity> {
    return this.get(scope, academyId, callerId);
  }

  async create(
    scope: TenantScope,
    input: CreateAcademyDto,
    actorUserId?: string,
  ): Promise<AcademyEntity> {
    const existing = await this.academiesRepository.findBySlug(scope, input.slug);
    if (existing) {
      throw AppException.conflict('SLUG_TAKEN', 'This academy slug is already in use.');
    }

    const academy = await this.academiesRepository.create(scope, {
      name: input.name,
      slug: input.slug,
      timezone: input.timezone,
      description: input.description,
      contactEmail: input.contactEmail,
      branding: input.branding,
      isPublic: input.isPublic,
    });

    await this.auditLog.record({
      action: 'academy.created',
      entityType: 'academy',
      entityId: academy.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toAcademyEntity(academy);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateAcademyDto,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<AcademyEntity> {
    await this.get(scope, id, actorUserId);
    try {
      const updated = await this.academiesRepository.update(
        scope,
        id,
        { ...input, branding: input.branding as Prisma.InputJsonValue },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'academy.updated',
        entityType: 'academy',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toAcademyEntity(updated);
    } catch (error) {
      if (error instanceof AcademyVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Academy has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  async archive(scope: TenantScope, id: string, actorUserId: string): Promise<AcademyEntity> {
    await this.get(scope, id, actorUserId);
    const updated = await this.academiesRepository.archive(id);
    await this.auditLog.record({
      action: 'academy.archived',
      entityType: 'academy',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toAcademyEntity(updated);
  }

  async restore(scope: TenantScope, id: string, actorUserId: string): Promise<AcademyEntity> {
    const academy = await this.academiesRepository.findByIdIncludingArchived(scope, id);
    if (!academy) {
      throw AppException.notFound('Academy not found.');
    }
    const academyScope = await this.resolveAcademyScope(scope, actorUserId);
    if (academyScope.restricted && academyScope.academyId !== id) {
      throw AppException.notFound('Academy not found.');
    }
    const updated = await this.academiesRepository.restore(id);
    await this.auditLog.record({
      action: 'academy.restored',
      entityType: 'academy',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toAcademyEntity(updated);
  }
}
