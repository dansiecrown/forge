import type { PracticalTaskSubmission, SubmissionReview } from '@prisma/client';
import type { PracticalTasksService } from '../../catalog/services/practical-tasks.service';
import type { CohortsService } from '../../cohorts/services/cohorts.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import type { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { UsersService } from '../../identity/services/users.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { PracticalTaskSubmissionsRepository } from '../repositories/practical-task-submissions.repository';
import type { SubmissionReviewsRepository } from '../repositories/submission-reviews.repository';
import { SubmissionReviewsService } from './submission-reviews.service';

const SCOPE = { organizationId: 'org-1' };

function fakeSubmission(overrides: Partial<PracticalTaskSubmission> = {}): PracticalTaskSubmission {
  return {
    id: 'submission-1',
    enrollmentId: 'enrollment-1',
    practicalTaskId: 'task-1',
    status: 'submitted',
    repositoryUrl: 'https://github.com/example/demo',
    liveDemoUrl: null,
    submittedAt: new Date('2027-02-01T00:00:00Z'),
    submissionMetadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeReview(overrides: Partial<SubmissionReview> = {}): SubmissionReview {
  return {
    id: 'review-1',
    organizationId: 'org-1',
    practicalTaskSubmissionId: 'submission-1',
    reviewerMembershipId: 'membership-1',
    status: 'revision_requested',
    comment: 'Please fix the README.',
    createdAt: new Date('2027-01-15T00:00:00Z'),
    ...overrides,
  };
}

function buildService(options: {
  submission?: PracticalTaskSubmission | null;
  enrollment?: EnrollmentEntity;
  reviews?: SubmissionReview[];
  mentorAssignedToCohort?: boolean;
  canManageAnyEnrollment?: boolean;
  hasMembership?: boolean;
}) {
  const submissionReviewsRepository = {
    listForSubmission: jest.fn(async () => options.reviews ?? []),
    recordDecision: jest.fn(async (_scope, submissionId, reviewerMembershipId, decision, comment) =>
      fakeReview({
        practicalTaskSubmissionId: submissionId,
        reviewerMembershipId,
        status: decision,
        comment,
      }),
    ),
  } as unknown as SubmissionReviewsRepository;

  const practicalTaskSubmissionsRepository = {
    findById: jest.fn(async () =>
      options.submission === undefined ? fakeSubmission() : options.submission,
    ),
  } as unknown as PracticalTaskSubmissionsRepository;

  const enrollmentsService = {
    get: jest.fn(
      async () =>
        options.enrollment ??
        ({ id: 'enrollment-1', userId: 'student-1', cohortId: 'cohort-1' } as EnrollmentEntity),
    ),
  } as unknown as EnrollmentsService;

  const cohortsService = {
    hasActiveMentorAssignment: jest.fn(async () => options.mentorAssignedToCohort ?? true),
    get: jest.fn(async () => ({ id: 'cohort-1', name: 'Cohort 2027' }) as never),
  } as unknown as CohortsService;

  const membershipsService = {
    getActiveMembership: jest.fn(async () =>
      (options.hasMembership ?? true) ? ({ id: 'membership-1' } as never) : null,
    ),
  } as unknown as MembershipsService;

  const permissionResolver = {
    hasPermission: jest.fn(async () => options.canManageAnyEnrollment ?? false),
  } as unknown as PermissionResolverService;

  const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;

  const usersService = {
    getById: jest.fn(async () => ({ id: 'student-1', displayName: 'Jamie Learner' }) as never),
  } as unknown as UsersService;

  const practicalTasksService = {
    get: jest.fn(async () => ({ id: 'task-1', title: 'Build a page' }) as never),
  } as unknown as PracticalTasksService;

  const service = new SubmissionReviewsService(
    submissionReviewsRepository,
    practicalTaskSubmissionsRepository,
    enrollmentsService,
    cohortsService,
    membershipsService,
    permissionResolver,
    usersService,
    practicalTasksService,
    auditLog,
  );
  return { service, submissionReviewsRepository };
}

describe('SubmissionReviewsService.recordDecision', () => {
  it('rejects reviewing a submission that is not currently submitted', async () => {
    const { service } = buildService({ submission: fakeSubmission({ status: 'draft' }) });
    await expect(
      service.recordDecision(SCOPE, 'submission-1', 'mentor-1', 'approved', undefined),
    ).rejects.toMatchObject({ response: { code: 'INVALID_STATE_TRANSITION' } });
  });

  it('requires a non-empty comment when requesting a revision', async () => {
    const { service } = buildService({});
    await expect(
      service.recordDecision(SCOPE, 'submission-1', 'mentor-1', 'revision_requested', undefined),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    await expect(
      service.recordDecision(SCOPE, 'submission-1', 'mentor-1', 'revision_requested', '   '),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('accepts an approval with no comment', async () => {
    const { service, submissionReviewsRepository } = buildService({});
    await service.recordDecision(SCOPE, 'submission-1', 'mentor-1', 'approved', undefined);
    expect(submissionReviewsRepository.recordDecision).toHaveBeenCalledWith(
      SCOPE,
      'submission-1',
      'membership-1',
      'approved',
      undefined,
    );
  });

  it('rejects a mentor not assigned to this submissions cohort', async () => {
    const { service } = buildService({
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(
      service.recordDecision(SCOPE, 'submission-1', 'mentor-1', 'approved', undefined),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });
});

describe('SubmissionReviewsService.listHistory', () => {
  it('derives isResubmission when a revision_requested review predates the current submittedAt', async () => {
    const { service } = buildService({
      submission: fakeSubmission({ submittedAt: new Date('2027-02-01T00:00:00Z') }),
      reviews: [fakeReview({ createdAt: new Date('2027-01-15T00:00:00Z') })],
    });
    const history = await service.listHistory(SCOPE, 'submission-1', 'mentor-1');
    expect(history.isResubmission).toBe(true);
  });

  it('is not a resubmission when there is no prior revision_requested review', async () => {
    const { service } = buildService({ reviews: [] });
    const history = await service.listHistory(SCOPE, 'submission-1', 'mentor-1');
    expect(history.isResubmission).toBe(false);
  });

  it('lets the owning student read their own review history without a mentor assignment', async () => {
    const { service } = buildService({
      enrollment: {
        id: 'enrollment-1',
        userId: 'student-1',
        cohortId: 'cohort-1',
      } as EnrollmentEntity,
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(service.listHistory(SCOPE, 'submission-1', 'student-1')).resolves.toBeDefined();
  });

  it('rejects a caller who is neither the owner nor an assigned mentor', async () => {
    const { service } = buildService({
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(service.listHistory(SCOPE, 'submission-1', 'someone-else')).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  });
});
