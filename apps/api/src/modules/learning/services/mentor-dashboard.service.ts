import { Injectable } from '@nestjs/common';
import { PracticalTasksService } from '../../catalog/services/practical-tasks.service';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { UsersService } from '../../identity/services/users.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toHuddleSessionEntity } from '../entities/huddle-session.entity';
import { toMentorNoteEntity } from '../entities/mentor-note.entity';
import type {
  MentorCohortSummary,
  MentorDashboard,
  MentorReviewQueueItem,
  MentorStudentSummary,
} from '../entities/mentor-workspace.entity';
import { HuddleSessionsRepository } from '../repositories/huddle-sessions.repository';
import { MentorNotesRepository } from '../repositories/mentor-notes.repository';
import { PracticalTaskSubmissionsRepository } from '../repositories/practical-task-submissions.repository';
import { SubmissionReviewsRepository } from '../repositories/submission-reviews.repository';
import { MentorWorkspaceService } from './mentor-workspace.service';

const RECENT_ITEMS_LIMIT = 5;

@Injectable()
export class MentorDashboardService {
  constructor(
    private readonly cohortsService: CohortsService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly usersService: UsersService,
    private readonly practicalTasksService: PracticalTasksService,
    private readonly mentorWorkspaceService: MentorWorkspaceService,
    private readonly practicalTaskSubmissionsRepository: PracticalTaskSubmissionsRepository,
    private readonly submissionReviewsRepository: SubmissionReviewsRepository,
    private readonly huddleSessionsRepository: HuddleSessionsRepository,
    private readonly mentorNotesRepository: MentorNotesRepository,
  ) {}

  /** Pending submissions across every cohort the caller mentors — the
   * cohort list is already mentor-scoped (`CohortsService.listMyCohorts`),
   * so no further per-item authorization check is needed here. */
  async listReviewQueue(scope: TenantScope, callerId: string): Promise<MentorReviewQueueItem[]> {
    const membership = await this.mentorWorkspaceService.requireMembership(scope, callerId);
    const cohorts = await this.cohortsService.listMyCohorts(membership.id);
    if (cohorts.length === 0) {
      return [];
    }
    const cohortById = new Map(cohorts.map((c) => [c.id, c]));

    const submissions = await this.practicalTaskSubmissionsRepository.listForCohorts(
      cohorts.map((c) => c.id),
      { status: 'submitted' },
    );
    if (submissions.length === 0) {
      return [];
    }

    const enrollments = await Promise.all(
      [...new Set(submissions.map((s) => s.enrollmentId))].map((id) =>
        this.enrollmentsService.get(scope, id),
      ),
    );
    const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));

    const users = await this.usersService.listByIds([...new Set(enrollments.map((e) => e.userId))]);
    const userById = new Map(users.map((u) => [u.id, u]));

    const tasks = await Promise.all(
      [...new Set(submissions.map((s) => s.practicalTaskId))].map((id) =>
        this.practicalTasksService.get(scope, id),
      ),
    );
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    const reviewsBySubmissionId = new Map(
      await Promise.all(
        submissions.map(
          async (s) =>
            [s.id, await this.submissionReviewsRepository.listForSubmission(s.id)] as const,
        ),
      ),
    );

    return submissions
      .map((s): MentorReviewQueueItem => {
        const enrollment = enrollmentById.get(s.enrollmentId);
        const user = enrollment ? userById.get(enrollment.userId) : undefined;
        const cohort = enrollment ? cohortById.get(enrollment.cohortId) : undefined;
        const task = taskById.get(s.practicalTaskId);
        const reviews = reviewsBySubmissionId.get(s.id) ?? [];
        const lastRevisionRequest = [...reviews]
          .reverse()
          .find((r) => r.status === 'revision_requested');
        const isResubmission =
          s.submittedAt !== null &&
          lastRevisionRequest !== undefined &&
          lastRevisionRequest.createdAt < s.submittedAt;

        return {
          submissionId: s.id,
          enrollmentId: s.enrollmentId,
          studentDisplayName: user?.displayName ?? 'Unknown learner',
          taskTitle: task?.title ?? 'Unknown task',
          cohortId: enrollment?.cohortId ?? '',
          cohortName: cohort?.name ?? 'Unknown cohort',
          submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
          isResubmission,
        };
      })
      .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
  }

  async getDashboard(scope: TenantScope, callerId: string): Promise<MentorDashboard> {
    const membership = await this.mentorWorkspaceService.requireMembership(scope, callerId);
    const cohorts = await this.cohortsService.listMyCohorts(membership.id);

    const cohortSummaries: MentorCohortSummary[] = [];
    const atRiskStudents: MentorStudentSummary[] = [];
    for (const cohort of cohorts) {
      const students = await this.mentorWorkspaceService.listStudents(
        scope,
        cohort.id,
        callerId,
        {},
      );
      atRiskStudents.push(...students.filter((s) => s.atRisk));
      cohortSummaries.push({
        id: cohort.id,
        name: cohort.name,
        slug: cohort.slug,
        status: cohort.status,
        studentCount: students.length,
        atRiskCount: students.filter((s) => s.atRisk).length,
      });
    }

    const [reviewQueue, recentHuddleSessions, recentNotes] = await Promise.all([
      this.listReviewQueue(scope, callerId),
      cohorts.length > 0
        ? this.huddleSessionsRepository.listRecentForCohorts(
            cohorts.map((c) => c.id),
            RECENT_ITEMS_LIMIT,
          )
        : Promise.resolve([]),
      this.mentorNotesRepository.listRecentByAuthor(scope, membership.id, RECENT_ITEMS_LIMIT),
    ]);

    return {
      cohorts: cohortSummaries,
      totalStudents: cohortSummaries.reduce((sum, c) => sum + c.studentCount, 0),
      atRiskStudents,
      reviewQueue,
      recentHuddleSessions: recentHuddleSessions.map(toHuddleSessionEntity),
      recentNotes: recentNotes.map(toMentorNoteEntity),
    };
  }
}
