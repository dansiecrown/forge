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
import type { UsersService } from '../../identity/services/users.service';
import { LessonCompletionsRepository } from '../repositories/lesson-completions.repository';
import { PracticalTaskSubmissionsRepository } from '../repositories/practical-task-submissions.repository';
import { ResourceAcknowledgmentsRepository } from '../repositories/resource-acknowledgments.repository';
import { ResourceBookmarksRepository } from '../repositories/resource-bookmarks.repository';
import { DeadlineService } from './deadline.service';
import { ProgressionService } from './progression.service';
import { StudentCurriculumService } from './student-curriculum.service';

const TRACK_ID = 'track-1';

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
                requiresPracticalWork: false,
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
                practicalTasks: [],
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
                lessons: [],
                resources: [
                  {
                    id: 'resource-2',
                    title: 'Locked resource',
                    resourceType: 'article',
                    url: null,
                    author: null,
                    provider: null,
                    estimatedDurationMinutes: null,
                    notes: null,
                    isRequired: false,
                    displayOrder: 0,
                    status: 'published',
                  },
                ],
                practicalTasks: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function fakeEnrollment(): EnrollmentEntity {
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
  };
}

function fakeCohort(): CohortEntity {
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
  };
}

function buildService() {
  const lessonCompletionsRepository = {
    listForEnrollment: jest.fn(async () => []),
    recordCompletion: jest.fn(async () => ({}) as never),
  } as unknown as LessonCompletionsRepository;
  const resourceAcknowledgmentsRepository = {
    listForEnrollment: jest.fn(async () => []),
    recordAcknowledgment: jest.fn(async () => ({}) as never),
  } as unknown as ResourceAcknowledgmentsRepository;
  const practicalTaskSubmissionsRepository = {
    listForEnrollment: jest.fn(async () => []),
  } as unknown as PracticalTaskSubmissionsRepository;
  const cohortsService = {
    get: jest.fn(async () => fakeCohort()),
  } as unknown as CohortsService;
  const enrollmentsService = {
    get: jest.fn(async () => fakeEnrollment()),
  } as unknown as EnrollmentsService;
  const lessonsService = {} as unknown as LessonsService;
  const learningResourcesService = {} as unknown as LearningResourcesService;
  const practicalTasksService = {} as unknown as PracticalTasksService;
  const permissionResolver = {
    hasPermission: jest.fn(async () => false),
  } as unknown as PermissionResolverService;
  const membershipsService = {
    getActiveMembership: jest.fn(async () => null),
  } as unknown as MembershipsService;
  const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;

  const progressionService = new ProgressionService(
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
  const deadlineService = new DeadlineService(progressionService);
  const bookmarksStore: { enrollmentId: string; resourceId: string }[] = [];
  const resourceBookmarksRepository = {
    listForEnrollment: jest.fn(async (enrollmentId: string) =>
      bookmarksStore
        .filter((b) => b.enrollmentId === enrollmentId)
        .map((b) => ({ resourceId: b.resourceId }) as never),
    ),
    add: jest.fn(async (enrollmentId: string, resourceId: string) => {
      bookmarksStore.push({ enrollmentId, resourceId });
    }),
    remove: jest.fn(async () => undefined),
  } as unknown as ResourceBookmarksRepository;
  const usersService = {
    getById: jest.fn(async () => ({ timezone: 'Africa/Lagos' }) as never),
  } as unknown as UsersService;

  return new StudentCurriculumService(
    progressionService,
    deadlineService,
    resourceBookmarksRepository,
    usersService,
  );
}

const SCOPE = { organizationId: 'org-1' };

describe('StudentCurriculumService', () => {
  it('lists module-1 as current and module-2 as locked', async () => {
    const service = buildService();
    const modules = await service.listWeeklyModules(SCOPE, 'enrollment-1', 'student-1');
    expect(modules.find((m) => m.id === 'module-1')?.lockState).toBe('current');
    expect(modules.find((m) => m.id === 'module-2')?.lockState).toBe('locked');
  });

  it('rejects fetching a locked modules detail', async () => {
    const service = buildService();
    await expect(
      service.getWeeklyModuleDetail(SCOPE, 'enrollment-1', 'student-1', 'module-2'),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });

  it('allows fetching the current modules detail', async () => {
    const service = buildService();
    const detail = await service.getWeeklyModuleDetail(
      SCOPE,
      'enrollment-1',
      'student-1',
      'module-1',
    );
    expect(detail.lessons).toHaveLength(1);
    expect(detail.resources[0].bookmarked).toBe(false);
  });

  it('excludes resources belonging to locked modules from the flat browse list', async () => {
    const service = buildService();
    const resources = await service.listLearningResources(SCOPE, 'enrollment-1', 'student-1', {});
    expect(resources.map((r) => r.id)).toEqual(['resource-1']);
  });

  it('rejects bookmarking a resource that does not exist in the active track', async () => {
    const service = buildService();
    await expect(
      service.addBookmark(SCOPE, 'enrollment-1', 'student-1', 'does-not-exist'),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });

  it('bookmarking then listing reflects the bookmark', async () => {
    const service = buildService();
    await service.addBookmark(SCOPE, 'enrollment-1', 'student-1', 'resource-1');
    const resources = await service.listLearningResources(SCOPE, 'enrollment-1', 'student-1', {
      bookmarked: true,
    });
    expect(resources.map((r) => r.id)).toEqual(['resource-1']);
  });

  it('the dashboard reports hasActiveTrack false when no track is selected', async () => {
    const service = buildService();
    jest.spyOn(ProgressionService.prototype, 'buildContext').mockResolvedValueOnce({
      enrollment: { ...fakeEnrollment(), currentLearningTrackId: null },
      cohort: fakeCohort(),
      track: null,
      modules: [],
      moduleLockStates: new Map(),
      completions: [],
      acknowledgments: [],
      submissions: [],
      completedLessonIds: new Set(),
      acknowledgedResourceIds: new Set(),
      submittedTaskIds: new Set(),
    });
    const dashboard = await service.getDashboard(SCOPE, 'enrollment-1', 'student-1');
    expect(dashboard.hasActiveTrack).toBe(false);
    expect(dashboard.nextUp).toBeNull();
  });
});
