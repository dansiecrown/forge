import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import { toOrganizationEntity, type OrganizationEntity } from '../entities/organization.entity';
import type { CreateOrganizationDto, UpdateOrganizationDto } from '../dtos/organization.dto';
import {
  OrganizationsRepository,
  OrganizationVersionConflictError,
} from '../repositories/organizations.repository';
import { PermissionResolverService } from './permission-resolver.service';

const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** `GET /organizations` is a platform-wide tenant list — never gated by an
   * org-scoped permission key alone, since a custom tenant role could
   * otherwise hold `organization.list` and see every tenant's data. */
  private async assertPlatformSuperAdmin(callerId: string): Promise<void> {
    const isSuperAdmin = await this.permissionResolver.hasPlatformRole(
      callerId,
      SUPER_ADMIN_ROLE_KEY,
    );
    if (!isSuperAdmin) {
      throw AppException.forbidden('This action requires platform Super Admin authority.');
    }
  }

  async list(
    callerId: string,
    options: { status?: string; q?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<OrganizationEntity>> {
    await this.assertPlatformSuperAdmin(callerId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.organizationsRepository.list({
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toOrganizationEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  /** Cross-tenant reads are treated as not-found, never forbidden — a caller
   * cannot confirm another organization's id exists by probing this route.
   * The scope-match check only applies to non-super-admin callers (an
   * ORG_ADMIN's `X-Organization-Id` must match the org they're reading) — a
   * platform Super Admin manages every organization and is not scoped by
   * whichever org happens to be their own "active" one, so their header
   * (if any) is never used to reject an otherwise-valid lookup. */
  async get(
    callerId: string,
    callerScopeOrganizationId: string | undefined,
    id: string,
  ): Promise<OrganizationEntity> {
    const organization = await this.organizationsRepository.findById(id);
    if (!organization) {
      throw AppException.notFound('Organization not found.');
    }

    if (callerScopeOrganizationId && callerScopeOrganizationId !== id) {
      const isSuperAdmin = await this.permissionResolver.hasPlatformRole(
        callerId,
        SUPER_ADMIN_ROLE_KEY,
      );
      if (!isSuperAdmin) {
        throw AppException.notFound('Organization not found.');
      }
    }

    return toOrganizationEntity(organization);
  }

  async create(callerId: string, input: CreateOrganizationDto): Promise<OrganizationEntity> {
    await this.assertPlatformSuperAdmin(callerId);
    const existing = await this.organizationsRepository.findBySlug(input.slug);
    if (existing) {
      throw AppException.conflict('SLUG_TAKEN', 'This organization slug is already in use.');
    }

    const organization = await this.organizationsRepository.create({
      name: input.name,
      slug: input.slug,
      legalName: input.legalName,
      defaultTimezone: input.defaultTimezone,
      country: input.country,
      supportEmail: input.supportEmail,
    });

    await this.auditLog.record({
      action: 'organization.created',
      entityType: 'organization',
      entityId: organization.id,
      outcome: 'success',
      organizationId: organization.id,
      actorUserId: callerId,
    });
    return toOrganizationEntity(organization);
  }

  async update(
    callerId: string,
    callerScopeOrganizationId: string | undefined,
    id: string,
    input: UpdateOrganizationDto,
    expectedVersion: number,
  ): Promise<OrganizationEntity> {
    await this.get(callerId, callerScopeOrganizationId, id);
    try {
      const updated = await this.organizationsRepository.update(
        id,
        {
          ...input,
          branding: input.branding as Prisma.InputJsonValue,
          settings: input.settings as Prisma.InputJsonValue,
        },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'organization.updated',
        entityType: 'organization',
        entityId: id,
        outcome: 'success',
        organizationId: id,
        actorUserId: callerId,
      });
      return toOrganizationEntity(updated);
    } catch (error) {
      if (error instanceof OrganizationVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Organization has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  async suspend(callerId: string, id: string, actorUserId?: string): Promise<OrganizationEntity> {
    await this.assertPlatformSuperAdmin(callerId);
    await this.get(callerId, undefined, id);
    const updated = await this.organizationsRepository.updateStatus(id, 'suspended');
    await this.auditLog.record({
      action: 'organization.suspended',
      entityType: 'organization',
      entityId: id,
      outcome: 'success',
      organizationId: id,
      actorUserId,
    });
    return toOrganizationEntity(updated);
  }

  /** "Soft delete" for Organization (docs/adr/0005): the doc's Organization
   * lifecycle is status-driven, not deleted_at-based, so this transitions to
   * `archived` rather than setting a deletion timestamp. */
  async archive(callerId: string, id: string, actorUserId?: string): Promise<OrganizationEntity> {
    await this.assertPlatformSuperAdmin(callerId);
    await this.get(callerId, undefined, id);
    const updated = await this.organizationsRepository.updateStatus(id, 'archived');
    await this.auditLog.record({
      action: 'organization.archived',
      entityType: 'organization',
      entityId: id,
      outcome: 'success',
      organizationId: id,
      actorUserId,
    });
    return toOrganizationEntity(updated);
  }

  async restore(callerId: string, id: string, actorUserId?: string): Promise<OrganizationEntity> {
    await this.assertPlatformSuperAdmin(callerId);
    await this.get(callerId, undefined, id);
    const updated = await this.organizationsRepository.updateStatus(id, 'active');
    await this.auditLog.record({
      action: 'organization.restored',
      entityType: 'organization',
      entityId: id,
      outcome: 'success',
      organizationId: id,
      actorUserId,
    });
    return toOrganizationEntity(updated);
  }
}
