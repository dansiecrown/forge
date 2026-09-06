import type { CohortEntity } from '../../cohorts/entities/cohort.entity';
import type { CohortsService } from '../../cohorts/services/cohorts.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import type { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { FellowshipTrackMentorsService } from '../../catalog/services/fellowship-track-mentors.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import type { UsersService } from '../../identity/services/users.service';
import type { HuddleAttendanceRepository } from '../repositories/huddle-attendance.repository';
import type { MentorNotesRepository } from '../repositories/mentor-notes.repository';
import type { PortfolioProjectsRepository } from '../repositories/portfolio-projects.repository';
import type { ProgressionContext, ProgressionService } from './progression.service';
import { MentorWorkspaceService } from './mentor-workspace.service';

const SCOPE = { organizationId: 'org-1' };
const FELLOWSHIP_ID = 'fellowship-1';
const COHORT_ID = 'cohort-1';
const TRACK_A = 'track-a';
const TRACK_B = 'track-b';

function fakeCohort(overrides: Partial<CohortEntity> = {}): CohortEntity {
  return {
    id: COHORT_ID,
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: FELLOWSHIP_ID,
    name: 'Cohort 2027',
    slug: 'cohort-2027',
    status: 'active',
    startsAt: new Date(),
    endsAt: new Date(),
    timezone: 'Africa/Lagos',
    capacity: 50,
    description: null,
    enrollmentDeadline: null,
    curriculumSnapshot: null,
    curriculumSnapshotAt: null,
    trackSwitchClosedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeEnrollment(overrides: Partial<EnrollmentEntity> = {}): EnrollmentEntity {
  return {
    id: `enrollment-${overrides.userId ?? 'x'}`,
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: FELLOWSHIP_ID,
    cohortId: COHORT_ID,
    userId: 'student-1',
    userDisplayName: null,
    userEmail: null,
    status: 'active',
    currentLearningTrackId: null,
    organizationName: null,
    academyName: null,
    fellowshipTitle: null,
    cohortName: null,
    currentLearningTrackName: null,
    invitedAt: new Date(),
    joinedAt: new Date(),
    endedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeContext(enrollment: EnrollmentEntity, cohort: CohortEntity): ProgressionContext {
  return {
    enrollment,
    cohort,
    track: null,
    modules: [],
    moduleLockStates: new Map(),
    completions: [],
    acknowledgments: [],
    submissions: [],
    completedLessonIds: new Set(),
    acknowledgedResourceIds: new Set(),
    submittedTaskIds: new Set(),
  } as unknown as ProgressionContext;
}

function buildService(options: {
  cohort?: CohortEntity;
  enrollments?: EnrollmentEntity[];
  mentorAssignedToCohort?: boolean;
  canManageAnyEnrollment?: boolean;
  trackMentorAssignments?: { fellowshipId: string; learningTrackId: string }[];
}) {
  const cohort = options.cohort ?? fakeCohort();
  const enrollments = options.enrollments ?? [];

  const cohortsService = {
    get: jest.fn(async () => cohort),
    hasActiveMentorAssignment: jest.fn(async () => options.mentorAssignedToCohort ?? false),
    listMyCohorts: jest.fn(async () => (options.mentorAssignedToCohort ? [cohort] : [])),
    listOfferingTracks: jest.fn(async () => []),
  } as unknown as CohortsService;

  const enrollmentsService = {
    list: jest.fn(async () => ({
      items: enrollments,
      page: { nextCursor: null, previousCursor: null, limit: 100, hasMore: false },
    })),
  } as unknown as EnrollmentsService;

  const membershipsService = {
    getActiveMembership: jest.fn(async () => ({ id: 'membership-1' })),
  } as unknown as MembershipsService;

  const permissionResolver = {
    hasPermission: jest.fn(async () => options.canManageAnyEnrollment ?? false),
  } as unknown as PermissionResolverService;

  const usersService = {
    listByIds: jest.fn(async (ids: string[]) =>
      ids.map((id) => ({ id, displayName: `User ${id}`, emailCanonical: `${id}@test.local` })),
    ),
  } as unknown as UsersService;

  const progressionService = {
    buildContext: jest.fn(async (_scope, enrollmentId: string) => {
      const enrollment = enrollments.find((e) => e.id === enrollmentId)!;
      return fakeContext(enrollment, cohort);
    }),
  } as unknown as ProgressionService;

  const fellowshipTrackMentorsService = {
    listActiveAssignmentsForMembership: jest.fn(async () => options.trackMentorAssignments ?? []),
  } as unknown as FellowshipTrackMentorsService;

  const service = new MentorWorkspaceService(
    cohortsService,
    enrollmentsService,
    membershipsService,
    permissionResolver,
    usersService,
    progressionService,
    {} as unknown as PortfolioProjectsRepository,
    {} as unknown as MentorNotesRepository,
    {} as unknown as HuddleAttendanceRepository,
    fellowshipTrackMentorsService,
  );
  return { service, cohortsService };
}

describe('MentorWorkspaceService.listStudents — track-scoped mentor access', () => {
  it('a cohort-wide mentor sees every enrolled student', async () => {
    const enrollments = [
      fakeEnrollment({ userId: 'student-a', currentLearningTrackId: TRACK_A }),
      fakeEnrollment({ userId: 'student-b', currentLearningTrackId: TRACK_B }),
      fakeEnrollment({ userId: 'student-c', currentLearningTrackId: null }),
    ];
    const { service } = buildService({ enrollments, mentorAssignedToCohort: true });

    const results = await service.listStudents(SCOPE, COHORT_ID, 'caller-1', {});
    expect(results.map((r) => r.userId).sort()).toEqual(['student-a', 'student-b', 'student-c']);
  });

  it('a Fellowship-wide track mentor sees only students on their assigned track', async () => {
    const enrollments = [
      fakeEnrollment({ userId: 'student-a', currentLearningTrackId: TRACK_A }),
      fakeEnrollment({ userId: 'student-b', currentLearningTrackId: TRACK_B }),
      fakeEnrollment({ userId: 'student-c', currentLearningTrackId: null }),
    ];
    const { service } = buildService({
      enrollments,
      mentorAssignedToCohort: false,
      trackMentorAssignments: [{ fellowshipId: FELLOWSHIP_ID, learningTrackId: TRACK_A }],
    });

    const results = await service.listStudents(SCOPE, COHORT_ID, 'caller-1', {});
    expect(results.map((r) => r.userId)).toEqual(['student-a']);
  });

  it('a track mentor for a different Fellowship sees no students in this cohort', async () => {
    const enrollments = [fakeEnrollment({ userId: 'student-a', currentLearningTrackId: TRACK_A })];
    const { service } = buildService({
      enrollments,
      mentorAssignedToCohort: false,
      trackMentorAssignments: [{ fellowshipId: 'other-fellowship', learningTrackId: TRACK_A }],
    });

    await expect(service.listStudents(SCOPE, COHORT_ID, 'caller-1', {})).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  });

  it('a caller with neither cohort-wide nor track access is rejected', async () => {
    const { service } = buildService({ enrollments: [], mentorAssignedToCohort: false });

    await expect(service.listStudents(SCOPE, COHORT_ID, 'caller-1', {})).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  });

  it('an admin (enrollment.manage) sees every student regardless of track', async () => {
    const enrollments = [
      fakeEnrollment({ userId: 'student-a', currentLearningTrackId: TRACK_A }),
      fakeEnrollment({ userId: 'student-b', currentLearningTrackId: TRACK_B }),
    ];
    const { service } = buildService({
      enrollments,
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: true,
    });

    const results = await service.listStudents(SCOPE, COHORT_ID, 'caller-1', {});
    expect(results.map((r) => r.userId).sort()).toEqual(['student-a', 'student-b']);
  });
});

describe('MentorWorkspaceService.listMyCohorts — track-only mentor discovery', () => {
  it('a track-only mentor (no CohortMentor row) still sees a cohort offering their track', async () => {
    const cohort = fakeCohort();
    const cohortsService = {
      listMyCohorts: jest.fn(async () => []), // no cohort-wide assignment at all
      listOfferingTracks: jest.fn(async () => [cohort]),
      hasActiveMentorAssignment: jest.fn(async () => false),
      get: jest.fn(async () => cohort),
    } as unknown as CohortsService;

    const enrollmentsService = {
      list: jest.fn(async () => ({
        items: [],
        page: { nextCursor: null, previousCursor: null, limit: 100, hasMore: false },
      })),
    } as unknown as EnrollmentsService;

    const membershipsService = {
      getActiveMembership: jest.fn(async () => ({ id: 'membership-1' })),
    } as unknown as MembershipsService;

    const fellowshipTrackMentorsService = {
      listActiveAssignmentsForMembership: jest.fn(async () => [
        { fellowshipId: FELLOWSHIP_ID, learningTrackId: TRACK_A },
      ]),
    } as unknown as FellowshipTrackMentorsService;

    const service = new MentorWorkspaceService(
      cohortsService,
      enrollmentsService,
      membershipsService,
      { hasPermission: jest.fn(async () => false) } as unknown as PermissionResolverService,
      { listByIds: jest.fn(async () => []) } as unknown as UsersService,
      { buildContext: jest.fn() } as unknown as ProgressionService,
      {} as unknown as PortfolioProjectsRepository,
      {} as unknown as MentorNotesRepository,
      {} as unknown as HuddleAttendanceRepository,
      fellowshipTrackMentorsService,
    );

    const cohorts = await service.listMyCohorts(SCOPE, 'caller-1');
    expect(cohorts.map((c) => c.id)).toEqual([cohort.id]);
    expect(cohortsService.listOfferingTracks).toHaveBeenCalledWith(SCOPE, [TRACK_A]);
  });
});
