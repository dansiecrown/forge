import { Injectable } from '@nestjs/common';
import type { SubmissionReviewDecision } from '@prisma/client';
import { PracticalTasksService } from '../../catalog/services/practical-tasks.service';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { UsersService } from '../../identity/services/users.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import {
  toSubmissionReviewEntity,
  type SubmissionReviewEntity,
} from '../entities/submission-review.entity';
import { PracticalTaskSubmissionsRepository } from '../repositories/practical-task-submissions.repository';
import { SubmissionReviewsRepository } from '../repositories/submission-reviews.repository';
import { assertMentorAssignedToCohort } from '../support/mentor-cohort-scope';

export interface SubmissionReviewHistory {
  reviews: SubmissionReviewEntity[];
  /** A submission is a resubmission when it is currently `submitted` and the
   * most recent `revision_requested` review predates its current
   * `submittedAt` — derived, not persisted (see
   * docs/adr/0008-mentor-experience.md Decision 2). */
  isResubmission: boolean;
}

export interface SubmissionDetail {
  id: string;
  enrollmentId: string;
  practicalTaskId: string;
  taskTitle: string;
  studentDisplayName: string;
  cohortId: string;
  cohortName: string;
  status: string;
  repositoryUrl: string | null;
  liveDemoUrl: string | null;
  submittedAt: Date | null;
}

@Injectable()
export class SubmissionReviewsService {
  constructor(
    private readonly submissionReviewsRepository: SubmissionReviewsRepository,
    private readonly practicalTaskSubmissionsRepository: PracticalTaskSubmissionsRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly cohortsService: CohortsService,
    private readonly membershipsService: MembershipsService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly usersService: UsersService,
    private readonly practicalTasksService: PracticalTasksService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async loadSubmissionAndEnrollment(
    scope: TenantScope,
    submissionId: string,
  ): Promise<{
    submission: NonNullable<Awaited<ReturnType<PracticalTaskSubmissionsRepository['findById']>>>;
    enrollment: EnrollmentEntity;
  }> {
    const submission = await this.practicalTaskSubmissionsRepository.findById(submissionId);
    if (!submission) {
      throw AppException.notFound('Submission not found.');
    }
    const enrollment = await this.enrollmentsService.get(scope, submission.enrollmentId);
    return { submission, enrollment };
  }

  async recordDecision(
    scope: TenantScope,
    submissionId: string,
    callerId: string,
    decision: SubmissionReviewDecision,
    comment: string | undefined,
  ): Promise<SubmissionReviewEntity> {
    const { submission, enrollment } = await this.loadSubmissionAndEnrollment(scope, submissionId);
    await assertMentorAssignedToCohort(
      this.cohortsService,
      this.membershipsService,
      this.permissionResolver,
      scope,
      callerId,
      enrollment.cohortId,
    );

    if (submission.status !== 'submitted') {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Only a submitted task can be reviewed (current status: ${submission.status}).`,
      );
    }
    if (decision === 'revision_requested' && !comment?.trim()) {
      throw AppException.validation([
        {
          field: 'comment',
          code: 'REQUIRED',
          message: 'A comment is required when requesting a revision.',
        },
      ]);
    }

    const reviewer = await this.membershipsService.getActiveMembership(scope, callerId);
    if (!reviewer) {
      throw AppException.validation([
        {
          field: 'callerId',
          code: 'NO_ACTIVE_MEMBERSHIP',
          message: 'You must be an active member of this organization to review submissions.',
        },
      ]);
    }

    const review = await this.submissionReviewsRepository.recordDecision(
      scope,
      submissionId,
      reviewer.id,
      decision,
      comment,
    );
    await this.auditLog.record({
      action: 'practical_task_submission.reviewed',
      entityType: 'practical_task_submission',
      entityId: submissionId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
      metadata: { decision, enrollmentId: enrollment.id },
    });
    return toSubmissionReviewEntity(review);
  }

  async listHistory(
    scope: TenantScope,
    submissionId: string,
    callerId: string,
  ): Promise<SubmissionReviewHistory> {
    const { submission, enrollment } = await this.loadSubmissionAndEnrollment(scope, submissionId);
    if (enrollment.userId !== callerId) {
      await assertMentorAssignedToCohort(
        this.cohortsService,
        this.membershipsService,
        this.permissionResolver,
        scope,
        callerId,
        enrollment.cohortId,
      );
    }

    const rows = await this.submissionReviewsRepository.listForSubmission(submissionId);
    const lastRevisionRequest = [...rows].reverse().find((r) => r.status === 'revision_requested');
    const isResubmission =
      submission.status === 'submitted' &&
      submission.submittedAt !== null &&
      lastRevisionRequest !== undefined &&
      lastRevisionRequest.createdAt < submission.submittedAt;

    return { reviews: rows.map(toSubmissionReviewEntity), isResubmission };
  }

  /** Dual-path — same self-owner-or-assigned-mentor rule as `listHistory`.
   * Assembles the read model the Submission Review page (and the review
   * queue's deep link into it) needs in one call: repo/demo URLs, task
   * title, student name, cohort name. */
  async getDetail(
    scope: TenantScope,
    submissionId: string,
    callerId: string,
  ): Promise<SubmissionDetail> {
    const { submission, enrollment } = await this.loadSubmissionAndEnrollment(scope, submissionId);
    if (enrollment.userId !== callerId) {
      await assertMentorAssignedToCohort(
        this.cohortsService,
        this.membershipsService,
        this.permissionResolver,
        scope,
        callerId,
        enrollment.cohortId,
      );
    }

    const [user, cohort, task] = await Promise.all([
      this.usersService.getById(enrollment.userId),
      this.cohortsService.get(scope, enrollment.cohortId),
      this.practicalTasksService.get(scope, submission.practicalTaskId),
    ]);

    return {
      id: submission.id,
      enrollmentId: enrollment.id,
      practicalTaskId: submission.practicalTaskId,
      taskTitle: task.title,
      studentDisplayName: user.displayName,
      cohortId: cohort.id,
      cohortName: cohort.name,
      status: submission.status,
      repositoryUrl: submission.repositoryUrl,
      liveDemoUrl: submission.liveDemoUrl,
      submittedAt: submission.submittedAt,
    };
  }
}
