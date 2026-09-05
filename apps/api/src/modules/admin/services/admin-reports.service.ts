import { Injectable } from '@nestjs/common';
import { MentorWorkspaceService } from '../../learning/services/mentor-workspace.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { AdminStatsRepository } from '../repositories/admin-stats.repository';

const DEFAULT_TREND_WEEKS = 8;

/** Every endpoint reuses an existing computation rather than re-deriving it
 * — `AdminStatsRepository` for aggregation queries, `MentorWorkspaceService`
 * for per-student progress/activity. "Simple charts only, no predictive
 * analytics" (the brief's own words): every method returns pre-aggregated
 * counts/rates for the frontend's hand-rolled SVG charts — no forecasting,
 * no stored time-series. See docs/adr/0009-administration-platform.md. */
@Injectable()
export class AdminReportsService {
  constructor(
    private readonly adminStatsRepository: AdminStatsRepository,
    private readonly mentorWorkspaceService: MentorWorkspaceService,
  ) {}

  getEnrollmentTrends(scope: TenantScope, weeks = DEFAULT_TREND_WEEKS) {
    return this.adminStatsRepository.getEnrollmentTrends(scope.organizationId, weeks);
  }

  getCompletionRates(fellowshipId: string) {
    return this.adminStatsRepository.getFellowshipStats(fellowshipId);
  }

  async getStudentActivity(scope: TenantScope, cohortId: string, callerId: string) {
    const students = await this.mentorWorkspaceService.listStudents(scope, cohortId, callerId, {});
    return {
      activeCount: students.filter((s) => !s.atRisk).length,
      atRiskCount: students.filter((s) => s.atRisk).length,
      students,
    };
  }

  getMentorActivity(scope: TenantScope) {
    return this.adminStatsRepository.getMentorActivity(scope.organizationId);
  }

  getSubmissionStats(scope: TenantScope, cohortId?: string) {
    return this.adminStatsRepository.getSubmissionStats(cohortId, scope.organizationId);
  }

  getAttendanceStats(cohortId: string) {
    return this.adminStatsRepository.getAttendanceStats(cohortId);
  }

  getOrganizationStats(scope: TenantScope) {
    return this.adminStatsRepository.getOrganizationStats(scope.organizationId);
  }

  getAcademyStats(academyId: string) {
    return this.adminStatsRepository.getAcademyStats(academyId);
  }

  getFellowshipStats(fellowshipId: string) {
    return this.adminStatsRepository.getFellowshipStats(fellowshipId);
  }
}
