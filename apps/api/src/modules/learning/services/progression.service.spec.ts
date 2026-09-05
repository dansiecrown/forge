import type { CurriculumSnapshot } from '../../catalog/services/curriculum-snapshot.service';
import type { LessonsService } from '../../catalog/services/lessons.service';
import type { LearningResourcesService } from '../../catalog/services/learning-resources.service';
import type { PracticalTasksService } from '../../catalog/services/practical-tasks.service';
import type { CohortEntity } from '../../cohorts/entities/cohort.entity';
import type { CohortsService } from '../../cohorts/services/cohorts.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import type { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import { LessonCompletionsRepository } from '../repositories/lesson-completions.repository';
import { PracticalTaskSubmissionsRepository } from '../repositories/practical-task-submissions.repository';
import { ResourceAcknowledgmentsRepository } from '../repositories/resource-acknowledgments.repository';
import { ProgressionService } from './progression.service';

const TRACK_ID = 'track-1';

/** One track, one course, two weekly modules — module 1 requires a lesson,
 * a resource and (via `requiresPracticalWork`) a task; module 2 requires
 * one lesson and has one optional (non-required) lesson too. */
function fakeSnapshot(): CurriculumSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    fellowshipId: 'fellowship-1',
    tracks: [
      {
        id: TRACK_ID,
        name: 'Web Development',
        slug: 'web-development',
        description: null,
        difficulty: 'beginner',
        estimatedWeeks: 2,
        learningOutcomes: [],
        status: 'published',
        displayOrder: 0,
        courses: [
          {
            id: 'course-1',
            title: 'HTML Foundations',
            slug: 'html-foundations',
            status: 'published',
            displayOrder: 0,
            weeklyModules: [
              {
                id: 'module-1',
                weekNumber: 1,
                title: 'Week 1',
                objectives: [],
                summary: null,
                estimatedStudyHours: null,
                status: 'published',
                requiresMentorHuddle: false,
                requiresPracticalWork: true,
                unlockRules: null,
                huddleScheduleMetadata: null,
                huddleMeetingLink: null,
                mentorHuddleNotes: null,
                huddleAttendanceRequired: false,
                lessons: [
                  {
                    id: 'lesson-1',
                    title: 'Intro',
                    description: null,
                    lessonType: 'article',
                    estimatedDurationMinutes: 30,
                    resourceUrl: null,
                    attachmentMetadata: null,
                    embeddedContentMetadata: null,
                    completionRequired: true,
                    displayOrder: 0,
                    status: 'published',
                  },
                ],
                resources: [
                  {
                    id: 'resource-1',
                    title: 'MDN',
                    resourceType: 'article',
                    url: null,
                    author: null,
                    provider: null,
                    estimatedDurationMinutes: 15,
                    notes: null,
                    isRequired: true,
                    displayOrder: 0,
                    status: 'published',
                  },
                ],
                practicalTasks: [
                  {
                    id: 'task-1',
                    title: 'Build a page',
                    description: null,
                    instructions: null,
                    deliverables: [],
                    dueOffsetDays: 7,
                    rubricMetadata: null,
                    maxScore: null,
                    displayOrder: 0,
                    status: 'published',
                  },
                ],
              },
              {
                id: 'module-2',
                weekNumber: 2,
                title: 'Week 2',
                objectives: [],
                summary: null,
                estimatedStudyHours: null,
                status: 'published',
                requiresMentorHuddle: false,
                requiresPracticalWork: false,
                unlockRules: null,
                huddleScheduleMetadata: null,
                huddleMeetingLink: null,
                mentorHuddleNotes: null,
                huddleAttendanceRequired: false,
                lessons: [
                  {
                    id: 'lesson-2',
                    title: 'CSS basics',
                    description: null,
                    lessonType: 'article',
                    estimatedDurationMinutes: 30,
                    resourceUrl: null,
                    attachmentMetadata: null,
                    embeddedContentMetadata: null,
                    completionRequired: true,
                    displayOrder: 0,
                    status: 'published',
                  },
                  {
                    id: 'lesson-3',
                    title: 'Optional deep dive',
                    description: null,
                    lessonType: 'article',
                    estimatedDurationMinutes: 45,
                    resourceUrl: null,
                    attachmentMetadata: null,
                    embeddedContentMetadata: null,
                    completionRequired: false,
                    displayOrder: 1,
                    status: 'published',
                  },
                ],
                resources: [],
                practicalTasks: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function fakeEnrollment(overrides: Partial<EnrollmentEntity> = {}): EnrollmentEntity {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: 'fellowship-1',
    cohortId: 'cohort-1',
    userId: 'student-1',
    status: 'active',
    currentLearningTrackId: TRACK_ID,
    invitedAt: new Date(),
    joinedAt: new Date('2027-01-01T00:00:00Z'),
    endedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeCohort(overrides: Partial<CohortEntity> = {}): CohortEntity {
  return {
    id: 'cohort-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: 'fellowship-1',
    name: 'Cohort 2027',
    slug: 'cohort-2027',
    status: 'active',
    startsAt: new Date('2027-01-01T00:00:00Z'),
    endsAt: new Date('2027-06-01T00:00:00Z'),
    timezone: 'Africa/Lagos',
    capacity: 50,
    description: null,
    enrollmentDeadline: null,
    curriculumSnapshot: fakeSnapshot(),
    curriculumSnapshotAt: new Date(),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(options: {
  completions?: string[];
  acknowledgments?: string[];
  /** `submitted` (default) rows satisfy the gate; `draft` and
   * `revision_requested` rows must not — both carry `submittedAt: null`,
   * matching `reviewDecisionUpdate`'s real re-lock mapping. */
  submissions?: { taskId: string; status?: 'draft' | 'submitted' | 'revision_requested' }[];
  enrollment?: EnrollmentEntity;
  cohort?: CohortEntity;
  /** Grants the org/academy-admin `enrollment.manage` bypass. */
  canManageAnyEnrollment?: boolean;
  /** Whether the caller has an active membership at all. */
  hasMembership?: boolean;
  /** Whether that membership is an active mentor assignment on the
   * enrollment's cohort. */
  mentorAssignedToCohort?: boolean;
}) {
  const lessonCompletionsRepository = {
    listForEnrollment: jest.fn(async () =>
      (options.completions ?? []).map(
        (lessonId) => ({ lessonId, completedAt: new Date() }) as never,
      ),
    ),
    recordCompletion: jest.fn(async () => ({}) as never),
  } as unknown as LessonCompletionsRepository;

  const resourceAcknowledgmentsRepository = {
    listForEnrollment: jest.fn(async () =>
      (options.acknowledgments ?? []).map(
        (resourceId) => ({ resourceId, acknowledgedAt: new Date() }) as never,
      ),
    ),
    recordAcknowledgment: jest.fn(async () => ({}) as never),
  } as unknown as ResourceAcknowledgmentsRepository;

  const practicalTaskSubmissionsRepository = {
    listForEnrollment: jest.fn(async () =>
      (options.submissions ?? []).map(
        (s) =>
          ({
            practicalTaskId: s.taskId,
            status: s.status ?? 'submitted',
            submittedAt: ['draft', 'revision_requested'].includes(s.status ?? 'submitted')
              ? null
              : new Date(),
          }) as never,
      ),
    ),
    findOne: jest.fn(async () => ({ status: 'draft' }) as never),
    saveDraft: jest.fn(async () => ({}) as never),
    submit: jest.fn(async () => ({}) as never),
  } as unknown as PracticalTaskSubmissionsRepository;

  const cohortsService = {
    get: jest.fn(async () => options.cohort ?? fakeCohort()),
    hasActiveMentorAssignment: jest.fn(async () => options.mentorAssignedToCohort ?? false),
  } as unknown as CohortsService;

  const enrollmentsService = {
    get: jest.fn(async () => options.enrollment ?? fakeEnrollment()),
  } as unknown as EnrollmentsService;

  const lessonsService = {
    assertBelongsToScope: jest.fn(async () => ({}) as never),
  } as unknown as LessonsService;
  const learningResourcesService = {
    assertBelongsToScope: jest.fn(async () => ({}) as never),
  } as unknown as LearningResourcesService;
  const practicalTasksService = {
    assertBelongsToScope: jest.fn(async () => ({ title: 'Build a page' }) as never),
  } as unknown as PracticalTasksService;

  const permissionResolver = {
    hasPermission: jest.fn(async () => options.canManageAnyEnrollment ?? false),
  } as unknown as PermissionResolverService;

  const membershipsService = {
    getActiveMembership: jest.fn(async () =>
      (options.hasMembership ?? true) ? ({ id: 'membership-1' } as never) : null,
    ),
  } as unknown as MembershipsService;

  const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;

  return new ProgressionService(
    lessonCompletionsRepository,
    resourceAcknowledgmentsRepository,
    practicalTaskSubmissionsRepository,
    cohortsService,
    enrollmentsService,
    lessonsService,
    learningResourcesService,
    practicalTasksService,
    permissionResolver,
    membershipsService,
    auditLog,
  );
}

describe('ProgressionService — sequential unlock', () => {
  it('keeps module 2 locked until all of module 1s required lessons, resources and tasks are done', async () => {
    const service = buildService({});
    const progress = await service.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );

    expect(progress.hasActiveTrack).toBe(true);
    expect(progress.currentModuleId).toBe('module-1');
    expect(progress.completedModuleIds).toEqual([]);
    expect(progress.lockedModuleIds).toEqual(['module-2']);
  });

  it('unlocks module 2 once module 1s lesson, resource and task are all satisfied', async () => {
    const service = buildService({
      completions: ['lesson-1'],
      acknowledgments: ['resource-1'],
      submissions: [{ taskId: 'task-1' }],
    });
    const progress = await service.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );

    expect(progress.currentModuleId).toBe('module-2');
    expect(progress.completedModuleIds).toEqual(['module-1']);
    expect(progress.lockedModuleIds).toEqual([]);
  });

  it('does not require an optional (non-required) lesson to unlock the next module', async () => {
    const service = buildService({
      completions: ['lesson-1', 'lesson-2'], // lesson-3 in module 2 is optional
      acknowledgments: ['resource-1'],
      submissions: [{ taskId: 'task-1' }],
    });
    const progress = await service.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );

    // All of module 1 done and module 2's only required lesson done -> module 2 (the last
    // module) is "current" (fully satisfied), nothing left locked.
    expect(progress.currentModuleId).toBe('module-2');
    expect(progress.lockedModuleIds).toEqual([]);
    expect(progress.completedModuleIds).toEqual(['module-1']);
  });

  it('a draft (not yet submitted) practical task submission does not satisfy the gate', async () => {
    const service = buildService({
      completions: ['lesson-1'],
      acknowledgments: ['resource-1'],
      submissions: [{ taskId: 'task-1', status: 'draft' }],
    });
    const progress = await service.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );

    expect(progress.currentModuleId).toBe('module-1');
    expect(progress.lockedModuleIds).toEqual(['module-2']);
  });

  /** Milestone 6's most important regression test — see
   * docs/adr/0008-mentor-experience.md Decision 2. Three independent
   * snapshots of the same submission row at three points in its lifecycle
   * (submitted -> revision requested -> resubmitted), proving the gate
   * re-locks and re-unlocks purely from `submittedAt`/`status`, with zero
   * logic duplicated between `SubmissionReviewsService` and
   * `ProgressionService`: a mentor's `revision_requested` decision (via
   * `reviewDecisionUpdate`, tested in isolation in
   * practical-task-submissions.repository.spec.ts) clears `submittedAt`,
   * and that alone is what this gate reacts to. */
  it('re-locks module 2 when a revision is requested, and re-unlocks it on resubmission', async () => {
    const submitted = buildService({
      completions: ['lesson-1'],
      acknowledgments: ['resource-1'],
      submissions: [{ taskId: 'task-1', status: 'submitted' }],
    });
    const afterSubmit = await submitted.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );
    expect(afterSubmit.currentModuleId).toBe('module-2');
    expect(afterSubmit.completedModuleIds).toEqual(['module-1']);

    const revisionRequested = buildService({
      completions: ['lesson-1'],
      acknowledgments: ['resource-1'],
      submissions: [{ taskId: 'task-1', status: 'revision_requested' }],
    });
    const afterRevisionRequest = await revisionRequested.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );
    expect(afterRevisionRequest.currentModuleId).toBe('module-1');
    expect(afterRevisionRequest.completedModuleIds).toEqual([]);
    expect(afterRevisionRequest.lockedModuleIds).toEqual(['module-2']);

    const resubmitted = buildService({
      completions: ['lesson-1'],
      acknowledgments: ['resource-1'],
      submissions: [{ taskId: 'task-1', status: 'submitted' }],
    });
    const afterResubmit = await resubmitted.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );
    expect(afterResubmit.currentModuleId).toBe('module-2');
    expect(afterResubmit.completedModuleIds).toEqual(['module-1']);
    expect(afterResubmit.lockedModuleIds).toEqual([]);
  });

  it('computes progressPercent from required lessons across the track', async () => {
    const service = buildService({ completions: ['lesson-1'] });
    const progress = await service.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );

    // 1 of 2 required lessons across the whole track (lesson-1, lesson-2) completed.
    expect(progress.progressPercent).toBe(50);
  });

  it('reports no active track when the enrollment has not selected one', async () => {
    const service = buildService({ enrollment: fakeEnrollment({ currentLearningTrackId: null }) });
    const progress = await service.getProgress(
      { organizationId: 'org-1' },
      'enrollment-1',
      'student-1',
    );

    expect(progress.hasActiveTrack).toBe(false);
    expect(progress.currentModuleId).toBeNull();
  });
});

describe('ProgressionService — completion recording', () => {
  it('is idempotent — completing the same lesson twice does not error', async () => {
    const service = buildService({});
    await expect(
      service.completeLesson({ organizationId: 'org-1' }, 'lesson-1', 'enrollment-1', 'student-1'),
    ).resolves.toBeUndefined();
    await expect(
      service.completeLesson({ organizationId: 'org-1' }, 'lesson-1', 'enrollment-1', 'student-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects recording progress for an enrollment the caller does not own', async () => {
    const service = buildService({});
    await expect(
      service.completeLesson(
        { organizationId: 'org-1' },
        'lesson-1',
        'enrollment-1',
        'someone-else',
      ),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });

  it('saves a practical task submission draft with no score — grading is out of scope', async () => {
    const service = buildService({});
    await expect(
      service.saveTaskSubmissionDraft(
        { organizationId: 'org-1' },
        'task-1',
        'enrollment-1',
        'student-1',
        { repositoryUrl: 'https://github.com/example/demo' },
      ),
    ).resolves.toBeUndefined();
  });

  it('submits a saved draft', async () => {
    const service = buildService({});
    await expect(
      service.submitTask({ organizationId: 'org-1' }, 'task-1', 'enrollment-1', 'student-1', null),
    ).resolves.toBeUndefined();
  });
});

describe('ProgressionService — progress read authorization', () => {
  it('lets a learner read their own progress', async () => {
    const service = buildService({});
    await expect(
      service.getProgress({ organizationId: 'org-1' }, 'enrollment-1', 'student-1'),
    ).resolves.toMatchObject({ enrollmentId: 'enrollment-1' });
  });

  it('rejects another student reading someone elses progress', async () => {
    const service = buildService({ canManageAnyEnrollment: false, mentorAssignedToCohort: false });
    await expect(
      service.getProgress({ organizationId: 'org-1' }, 'enrollment-1', 'another-student'),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });

  it('lets an org/academy admin (enrollment.manage) read any enrollments progress', async () => {
    const service = buildService({ canManageAnyEnrollment: true });
    await expect(
      service.getProgress({ organizationId: 'org-1' }, 'enrollment-1', 'admin-1'),
    ).resolves.toMatchObject({ enrollmentId: 'enrollment-1' });
  });

  it('lets a mentor assigned to the enrollments cohort read its progress', async () => {
    const service = buildService({ canManageAnyEnrollment: false, mentorAssignedToCohort: true });
    await expect(
      service.getProgress({ organizationId: 'org-1' }, 'enrollment-1', 'mentor-1'),
    ).resolves.toMatchObject({ enrollmentId: 'enrollment-1' });
  });

  it('rejects a mentor holding org-wide enrollment.read but not assigned to this cohort — the Phase 8 acceptance criterion', async () => {
    const service = buildService({ canManageAnyEnrollment: false, mentorAssignedToCohort: false });
    await expect(
      service.getProgress({ organizationId: 'org-1' }, 'enrollment-1', 'unassigned-mentor'),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });
});
