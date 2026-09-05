import { Injectable } from '@nestjs/common';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { UsersService } from '../../identity/services/users.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toMentorNoteEntity } from '../entities/mentor-note.entity';
import type {
  MentorCohortSummary,
  MentorStudentSubmissionView,
  MentorStudentSummary,
  MentorStudentWorkspace,
} from '../entities/mentor-workspace.entity';
import { toPortfolioProjectEntity } from '../entities/portfolio-project.entity';
import { HuddleAttendanceRepository } from '../repositories/huddle-attendance.repository';
import { MentorNotesRepository } from '../repositories/mentor-notes.repository';
import { PortfolioProjectsRepository } from '../repositories/portfolio-projects.repository';
import { assertMentorAssignedToCohort } from '../support/mentor-cohort-scope';
import {
  computeLastActivityAt,
  isFallingBehindCohortMedian,
  isInactive,
} from '../utils/learning-stats.util';
import { ProgressionService, summarizeProgress } from './progression.service';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/** Simple, transparent, reason-carrying heuristics computed on read from
 * existing progression timestamps — never a bare score, per
 * docs/product-design-specification.md's "risk reason must be inspectable
 * and not inferred as fact." Placeholder pending product-approved risk
 * criteria — see docs/KNOWN_TECHNICAL_DEBT.md. */
function computeAtRisk(
  progressPercent: number,
  cohortMedianPercent: number,
  lastActivityAt: Date | null,
  now: Date,
  compareToMedian: boolean,
): { atRisk: boolean; atRiskReason: string | null } {
  const inactive = isInactive(lastActivityAt, now);
  const behind =
    compareToMedian && isFallingBehindCohortMedian(progressPercent, cohortMedianPercent);

  if (inactive && behind) {
    return {
      atRisk: true,
      atRiskReason: `${lastActivityAt ? `Inactive for ${daysSince(lastActivityAt, now)} days` : 'No activity recorded yet'} and ${Math.round(cohortMedianPercent - progressPercent)}% behind the cohort median.`,
    };
  }
  if (inactive) {
    return {
      atRisk: true,
      atRiskReason: lastActivityAt
        ? `Inactive for ${daysSince(lastActivityAt, now)} days.`
        : 'No activity recorded yet.',
    };
  }
  if (behind) {
    return {
      atRisk: true,
      atRiskReason: `${Math.round(cohortMedianPercent - progressPercent)}% behind the cohort median progress (${Math.round(cohortMedianPercent)}%).`,
    };
  }
  return { atRisk: false, atRiskReason: null };
}

@Injectable()
export class MentorWorkspaceService {
  constructor(
    private readonly cohortsService: CohortsService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly membershipsService: MembershipsService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly usersService: UsersService,
    private readonly progressionService: ProgressionService,
    private readonly portfolioProjectsRepository: PortfolioProjectsRepository,
    private readonly mentorNotesRepository: MentorNotesRepository,
    private readonly huddleAttendanceRepository: HuddleAttendanceRepository,
  ) {}

  private assertMentor(scope: TenantScope, callerId: string, cohortId: string): Promise<void> {
    return assertMentorAssignedToCohort(
      this.cohortsService,
      this.membershipsService,
      this.permissionResolver,
      scope,
      callerId,
      cohortId,
    );
  }

  async requireMembership(scope: TenantScope, callerId: string): Promise<{ id: string }> {
    const membership = await this.membershipsService.getActiveMembership(scope, callerId);
    if (!membership) {
      throw AppException.validation([
        {
          field: 'callerId',
          code: 'NO_ACTIVE_MEMBERSHIP',
          message: 'You must be an active member of this organization to access the mentor portal.',
        },
      ]);
    }
    return membership;
  }

  /** Cohorts the caller is actively assigned to as a mentor — org/academy
   * admins acting on a cohort outside their own assignments use the
   * cohort-scoped routes directly, not this "my cohorts" list. */
  async listMyCohorts(scope: TenantScope, callerId: string): Promise<MentorCohortSummary[]> {
    const membership = await this.requireMembership(scope, callerId);
    const cohorts = await this.cohortsService.listMyCohorts(membership.id);

    return Promise.all(
      cohorts.map(async (cohort) => {
        const students = await this.listStudents(scope, cohort.id, callerId, {});
        return {
          id: cohort.id,
          name: cohort.name,
          slug: cohort.slug,
          status: cohort.status,
          studentCount: students.length,
          atRiskCount: students.filter((s) => s.atRisk).length,
        };
      }),
    );
  }

  async listStudents(
    scope: TenantScope,
    cohortId: string,
    callerId: string,
    filters: { q?: string; status?: string; sort?: 'name' | 'progress' | 'status' },
  ): Promise<MentorStudentSummary[]> {
    await this.assertMentor(scope, callerId, cohortId);

    const enrollments = await this.enrollmentsService.list(scope, { cohortId, limit: '100' });
    if (enrollments.items.length === 0) {
      return [];
    }

    const users = await this.usersService.listByIds(enrollments.items.map((e) => e.userId));
    const userById = new Map(users.map((u) => [u.id, u]));

    const now = new Date();
    const contexts = await Promise.all(
      enrollments.items.map((e) => this.progressionService.buildContext(scope, e.id, callerId)),
    );
    const summaries = contexts.map((ctx) => ({
      ctx,
      summary: summarizeProgress(ctx),
      lastActivityAt: computeLastActivityAt(ctx),
    }));
    const cohortMedian = median(summaries.map((s) => s.summary.progressPercent));

    let results: MentorStudentSummary[] = enrollments.items.map((enrollment, index) => {
      const user = userById.get(enrollment.userId);
      const { summary, lastActivityAt } = summaries[index];
      const { atRisk, atRiskReason } = computeAtRisk(
        summary.progressPercent,
        cohortMedian,
        lastActivityAt,
        now,
        true,
      );
      return {
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        displayName: user?.displayName ?? 'Unknown learner',
        email: user?.emailCanonical ?? '',
        status: enrollment.status,
        progressPercent: summary.progressPercent,
        currentModuleId: summary.currentModule?.id ?? null,
        currentWeekNumber: summary.currentModule?.weekNumber ?? null,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        atRisk,
        atRiskReason,
      };
    });

    if (filters.status) {
      results = results.filter((r) => r.status === filters.status);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      results = results.filter(
        (r) => r.displayName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
      );
    }
    if (filters.sort === 'progress') {
      results.sort((a, b) => b.progressPercent - a.progressPercent);
    } else if (filters.sort === 'status') {
      results.sort((a, b) => a.status.localeCompare(b.status));
    } else {
      results.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return results;
  }

  /** One aggregation — progress summary, current/locked modules,
   * submissions, portfolio, recent mentor notes, attendance history, and an
   * inactivity-based at-risk flag. Authorization flows entirely through
   * `ProgressionService.buildContext`'s tightened `assertCanRead` — no
   * duplicated gate logic here. The cohort-median comparison used on the
   * roster (`listStudents`) is deliberately not repeated here to avoid
   * re-scanning the whole cohort for a single-student view. */
  async getStudentWorkspace(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<MentorStudentWorkspace> {
    const ctx = await this.progressionService.buildContext(scope, enrollmentId, callerId);
    const [user, portfolioRows, noteRows, attendanceRows] = await Promise.all([
      this.usersService.getById(ctx.enrollment.userId),
      this.portfolioProjectsRepository.list(scope, enrollmentId),
      this.mentorNotesRepository.list(scope, enrollmentId),
      this.huddleAttendanceRepository.listForEnrollment(enrollmentId),
    ]);
    const cohort = ctx.cohort;

    const summary = summarizeProgress(ctx);
    const lastActivityAt = computeLastActivityAt(ctx);
    const { atRisk, atRiskReason } = computeAtRisk(
      summary.progressPercent,
      summary.progressPercent,
      lastActivityAt,
      new Date(),
      false,
    );

    const taskById = new Map(ctx.modules.flatMap((m) => m.practicalTasks.map((t) => [t.id, t])));
    const submissions: MentorStudentSubmissionView[] = ctx.submissions
      .filter((s) => s.submittedAt !== null)
      .map((s) => ({
        id: s.id,
        practicalTaskId: s.practicalTaskId,
        taskTitle: taskById.get(s.practicalTaskId)?.title ?? 'Unknown task',
        status: s.status,
        repositoryUrl: s.repositoryUrl,
        liveDemoUrl: s.liveDemoUrl,
        submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      }));

    return {
      enrollmentId: ctx.enrollment.id,
      userId: ctx.enrollment.userId,
      displayName: user.displayName,
      email: user.emailCanonical,
      cohortId: cohort.id,
      cohortName: cohort.name,
      status: ctx.enrollment.status,
      progressPercent: summary.progressPercent,
      currentModuleId: summary.currentModule?.id ?? null,
      currentWeekNumber: summary.currentModule?.weekNumber ?? null,
      completedModuleIds: summary.completedModuleIds,
      lockedModuleIds: summary.lockedModuleIds,
      submissions,
      portfolioProjects: portfolioRows.map(toPortfolioProjectEntity),
      notes: noteRows.map(toMentorNoteEntity),
      attendance: attendanceRows.map((row) => ({
        id: row.id,
        huddleSessionId: row.huddleSessionId,
        enrollmentId: row.enrollmentId,
        status: row.status,
        recordedByMembershipId: row.recordedByMembershipId,
        recordedAt: row.recordedAt,
        weekNumber: row.huddleSession.weekNumber,
      })),
      atRisk,
      atRiskReason,
    };
  }
}
