import { Injectable } from '@nestjs/common';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { MentorWorkspaceService } from '../../learning/services/mentor-workspace.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { AdminStatsRepository } from '../repositories/admin-stats.repository';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Deliberately minimal net-new logic — every sub-feature here reuses an
 * existing service wherever the data is already computed elsewhere
 * (`MentorWorkspaceService.listStudents` for the roster/progress overview,
 * `AdminStatsRepository` for the two genuinely new aggregations —
 * attendance and completion summaries). An admin caller transparently
 * passes `assertMentorAssignedToCohort`'s `enrollment.manage` bypass with
 * zero code changes to `learning`. See
 * docs/adr/0009-administration-platform.md. */
@Injectable()
export class AdminCohortsService {
  constructor(
    private readonly cohortsService: CohortsService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly mentorWorkspaceService: MentorWorkspaceService,
    private readonly adminStatsRepository: AdminStatsRepository,
  ) {}

  async getOverview(scope: TenantScope, cohortId: string, callerId: string) {
    const [cohort, mentors, activeStudentCount] = await Promise.all([
      this.cohortsService.get(scope, cohortId, callerId),
      this.cohortsService.listMentors(scope, cohortId, callerId),
      this.adminStatsRepository.getEnrollmentCountForCohort(cohortId),
    ]);
    return {
      cohort,
      capacity: cohort.capacity,
      enrolledCount: activeStudentCount,
      mentorCount: mentors.length,
      curriculumSnapshotAt: cohort.curriculumSnapshotAt,
    };
  }

  async getProgressOverview(scope: TenantScope, cohortId: string, callerId: string) {
    const students = await this.mentorWorkspaceService.listStudents(scope, cohortId, callerId, {});
    const distribution = students.map((s) => s.progressPercent);
    return { medianProgressPercent: median(distribution), distribution };
  }

  /** `cohortsService.get()` here is purely an existence + hierarchy-scope
   * guard (Milestone 7, closes DEBT-015) before touching the stats
   * repository directly by id. */
  async getAttendanceSummary(scope: TenantScope, cohortId: string, callerId: string) {
    await this.cohortsService.get(scope, cohortId, callerId);
    const byStatus = await this.adminStatsRepository.getAttendanceStats(cohortId);
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    const present = byStatus.present ?? 0;
    return { byStatus, rate: total === 0 ? 0 : Math.round((present / total) * 100) };
  }

  async getCompletionSummary(scope: TenantScope, cohortId: string, callerId: string) {
    await this.cohortsService.get(scope, cohortId, callerId);
    const enrollments = await this.enrollmentsService.list(scope, { cohortId, limit: '100' });
    const totalCount = enrollments.items.length;
    const completedCount = enrollments.items.filter((e) => e.status === 'completed').length;
    return {
      completedCount,
      totalCount,
      rate: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
    };
  }
}
