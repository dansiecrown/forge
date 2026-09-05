import { Injectable } from '@nestjs/common';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AuditLogService } from '../../platform/audit-log.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { AdminStatsRepository, type PlatformCounts } from '../repositories/admin-stats.repository';
import { assertPlatformSuperAdmin } from '../support/assert-platform-super-admin';

export interface AdminDashboard extends PlatformCounts {
  enrollmentTrend: { weekStart: string; count: number }[];
  completionRate: number;
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorUserId: string | null;
    occurredAt: Date;
  }[];
}

const RECENT_ACTIVITY_LIMIT = 10;
const TREND_WEEKS = 8;

/** Pure aggregation — no schema of its own. Every number is computed on
 * read from existing rows, matching `learning-stats.util.ts`'s established
 * "no stored time-series" precedent. See
 * docs/adr/0009-administration-platform.md. */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly adminStatsRepository: AdminStatsRepository,
    private readonly auditLogService: AuditLogService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  /** Cross-organization view — SUPER_ADMIN only, since `reports.read` alone
   * could be granted by a custom tenant role and would otherwise leak every
   * tenant's aggregate counts. */
  async getPlatformDashboard(callerId: string): Promise<AdminDashboard> {
    await assertPlatformSuperAdmin(this.permissionResolver, callerId);
    const [counts, recentActivity] = await Promise.all([
      this.adminStatsRepository.getPlatformCounts(),
      this.auditLogService.search({ limit: RECENT_ACTIVITY_LIMIT }),
    ]);
    return {
      ...counts,
      enrollmentTrend: [],
      completionRate: 0,
      recentActivity: recentActivity.items.map(toActivityRow),
    };
  }

  async getOrganizationDashboard(scope: TenantScope): Promise<AdminDashboard> {
    const [counts, enrollmentTrend, orgStats, completedCount, recentActivity] = await Promise.all([
      this.adminStatsRepository.getOrganizationCounts(scope.organizationId),
      this.adminStatsRepository.getEnrollmentTrends(scope.organizationId, TREND_WEEKS),
      this.adminStatsRepository.getOrganizationStats(scope.organizationId),
      this.adminStatsRepository.getCompletedEnrollmentCount(scope.organizationId),
      this.auditLogService.search({
        organizationId: scope.organizationId,
        limit: RECENT_ACTIVITY_LIMIT,
      }),
    ]);
    const completionRate =
      orgStats.enrollmentCount === 0
        ? 0
        : Math.round((completedCount / orgStats.enrollmentCount) * 100);
    return {
      ...counts,
      enrollmentTrend,
      completionRate,
      recentActivity: recentActivity.items.map(toActivityRow),
    };
  }
}

function toActivityRow(entry: {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  occurredAt: Date;
}) {
  return {
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    actorUserId: entry.actorUserId,
    occurredAt: entry.occurredAt,
  };
}
