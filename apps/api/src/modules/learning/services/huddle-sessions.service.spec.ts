import type { HuddleSession } from '@prisma/client';
import type { CohortsService } from '../../cohorts/services/cohorts.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import type { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { HuddleAttendanceRepository } from '../repositories/huddle-attendance.repository';
import type { HuddleSessionsRepository } from '../repositories/huddle-sessions.repository';
import { HuddleSessionsService } from './huddle-sessions.service';

const SCOPE = { organizationId: 'org-1' };

function fakeSession(overrides: Partial<HuddleSession> = {}): HuddleSession {
  return {
    id: 'session-1',
    organizationId: 'org-1',
    cohortId: 'cohort-1',
    weekNumber: 1,
    notes: null,
    discussionTopics: [],
    actionItems: [],
    createdByMembershipId: 'membership-1',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(options: {
  session?: HuddleSession | null;
  mentorAssignedToCohort?: boolean;
  canManageAnyEnrollment?: boolean;
  hasMembership?: boolean;
  enrollmentCohortId?: string;
}) {
  const huddleSessionsRepository = {
    findById: jest.fn(async () =>
      options.session === undefined ? fakeSession() : options.session,
    ),
    findByCohortAndWeek: jest.fn(async () => fakeSession()),
    upsert: jest.fn(async (_scope, cohortId, weekNumber, createdByMembershipId, data) =>
      fakeSession({ cohortId, weekNumber, createdByMembershipId, ...data }),
    ),
  } as unknown as HuddleSessionsRepository;

  const huddleAttendanceRepository = {
    upsert: jest.fn(async (huddleSessionId, enrollmentId, status, recordedByMembershipId) => ({
      id: `attendance-${enrollmentId}`,
      huddleSessionId,
      enrollmentId,
      status,
      recordedByMembershipId,
      recordedAt: new Date(),
      updatedAt: new Date(),
    })),
    listForEnrollment: jest.fn(async () => []),
    listForSession: jest.fn(async () => []),
  } as unknown as HuddleAttendanceRepository;

  const cohortsService = {
    hasActiveMentorAssignment: jest.fn(async () => options.mentorAssignedToCohort ?? true),
  } as unknown as CohortsService;

  const enrollmentsService = {
    get: jest.fn(
      async () =>
        ({
          id: 'enrollment-1',
          userId: 'student-1',
          cohortId: options.enrollmentCohortId ?? 'cohort-1',
        }) as EnrollmentEntity,
    ),
  } as unknown as EnrollmentsService;

  const membershipsService = {
    getActiveMembership: jest.fn(async () =>
      (options.hasMembership ?? true) ? ({ id: 'membership-1' } as never) : null,
    ),
  } as unknown as MembershipsService;

  const permissionResolver = {
    hasPermission: jest.fn(async () => options.canManageAnyEnrollment ?? false),
  } as unknown as PermissionResolverService;

  const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;

  const service = new HuddleSessionsService(
    huddleSessionsRepository,
    huddleAttendanceRepository,
    cohortsService,
    enrollmentsService,
    membershipsService,
    permissionResolver,
    auditLog,
  );
  return { service, huddleSessionsRepository, huddleAttendanceRepository };
}

describe('HuddleSessionsService.upsertSession', () => {
  it('upserts on (cohortId, weekNumber), attributing the caller’s membership', async () => {
    const { service, huddleSessionsRepository } = buildService({});
    await service.upsertSession(SCOPE, 'cohort-1', 3, 'mentor-1', { notes: 'Great session' });
    expect(huddleSessionsRepository.upsert).toHaveBeenCalledWith(
      SCOPE,
      'cohort-1',
      3,
      'membership-1',
      { notes: 'Great session' },
    );
  });

  it('rejects a mentor not assigned to this cohort', async () => {
    const { service } = buildService({
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(service.upsertSession(SCOPE, 'cohort-1', 3, 'mentor-1', {})).rejects.toMatchObject(
      { response: { code: 'PERMISSION_DENIED' } },
    );
  });
});

describe('HuddleSessionsService.recordAttendance', () => {
  it('records attendance for each entry, attributing the recorder', async () => {
    const { service, huddleAttendanceRepository } = buildService({});
    await service.recordAttendance(SCOPE, 'session-1', 'mentor-1', [
      { enrollmentId: 'enrollment-1', status: 'present' },
    ]);
    expect(huddleAttendanceRepository.upsert).toHaveBeenCalledWith(
      'session-1',
      'enrollment-1',
      'present',
      'membership-1',
    );
  });

  it('rejects an attendance entry for a learner outside this huddle’s cohort', async () => {
    const { service } = buildService({ enrollmentCohortId: 'cohort-2' });
    await expect(
      service.recordAttendance(SCOPE, 'session-1', 'mentor-1', [
        { enrollmentId: 'enrollment-1', status: 'present' },
      ]),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects recording attendance for a session that does not exist', async () => {
    const { service } = buildService({ session: null });
    await expect(
      service.recordAttendance(SCOPE, 'missing-session', 'mentor-1', []),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });
});

describe('HuddleSessionsService.listAttendanceForEnrollment', () => {
  it('lets the enrolled student read their own attendance', async () => {
    const { service } = buildService({
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(
      service.listAttendanceForEnrollment(SCOPE, 'enrollment-1', 'student-1'),
    ).resolves.toEqual([]);
  });

  it('rejects a caller who is neither the student nor an assigned mentor', async () => {
    const { service } = buildService({
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(
      service.listAttendanceForEnrollment(SCOPE, 'enrollment-1', 'someone-else'),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });
});

describe('HuddleSessionsService.listAttendanceForSession', () => {
  it('rejects a mentor not assigned to this session’s cohort', async () => {
    const { service } = buildService({
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(
      service.listAttendanceForSession(SCOPE, 'session-1', 'mentor-1'),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });

  it('rejects listing attendance for a session that does not exist', async () => {
    const { service } = buildService({ session: null });
    await expect(
      service.listAttendanceForSession(SCOPE, 'missing-session', 'mentor-1'),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });
});
