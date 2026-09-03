import { Injectable } from '@nestjs/common';
import type { AuditOutcome } from '@prisma/client';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { assertPlatformSuperAdmin } from '../support/assert-platform-super-admin';

export interface AuditSearchFilters {
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  outcome?: AuditOutcome;
  occurredFrom?: string;
  occurredTo?: string;
  cursor?: string;
  limit?: string;
}

/** Audit Center read-side. The org-scoped route (`search`) always forces
 * `organizationId` to the caller's active scope — `audit.read` alone would
 * otherwise let a custom tenant role read another organization's log via a
 * spoofed filter. The platform-wide route (`searchPlatform`) is a separate,
 * SUPER_ADMIN-gated method, matching the Dashboard/Settings services' same
 * "cross-org view needs a stronger gate than the permission key alone"
 * pattern. See docs/adr/0009-administration-platform.md. */
@Injectable()
export class AdminAuditService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  search(scope: TenantScope, filters: AuditSearchFilters) {
    return this.auditLogService.search({
      organizationId: scope.organizationId,
      actorUserId: filters.actorUserId,
      entityType: filters.entityType,
      entityId: filters.entityId,
      action: filters.action,
      outcome: filters.outcome,
      occurredFrom: filters.occurredFrom ? new Date(filters.occurredFrom) : undefined,
      occurredTo: filters.occurredTo ? new Date(filters.occurredTo) : undefined,
      cursor: filters.cursor,
      limit: parseLimit(filters.limit),
    });
  }

  /** Platform-wide search across every organization — SUPER_ADMIN only. */
  async searchPlatform(
    callerId: string,
    filters: AuditSearchFilters & { organizationId?: string },
  ) {
    await assertPlatformSuperAdmin(this.permissionResolver, callerId);
    return this.auditLogService.search({
      organizationId: filters.organizationId,
      actorUserId: filters.actorUserId,
      entityType: filters.entityType,
      entityId: filters.entityId,
      action: filters.action,
      outcome: filters.outcome,
      occurredFrom: filters.occurredFrom ? new Date(filters.occurredFrom) : undefined,
      occurredTo: filters.occurredTo ? new Date(filters.occurredTo) : undefined,
      cursor: filters.cursor,
      limit: parseLimit(filters.limit),
    });
  }

  async getById(scope: TenantScope | undefined, callerId: string, id: string) {
    const entry = await this.auditLogService.getById(id);
    if (!entry) {
      throw AppException.notFound('Audit log entry not found.');
    }
    if (scope && entry.organizationId && entry.organizationId !== scope.organizationId) {
      const isSuperAdmin = await this.permissionResolver.hasPlatformRole(callerId, 'SUPER_ADMIN');
      if (!isSuperAdmin) {
        throw AppException.notFound('Audit log entry not found.');
      }
    }
    return entry;
  }
}
