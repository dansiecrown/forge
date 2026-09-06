import type { Enrollment } from '@prisma/client';
import type { FellowshipsService } from '../../catalog/services/fellowships.service';
import type { LearningTrackEntity } from '../../catalog/entities/learning-track.entity';
import type { LearningTracksService } from '../../catalog/services/learning-tracks.service';
import type { UsersService } from '../../identity/services/users.service';
import type { CohortEntity } from '../entities/cohort.entity';
import type { CohortsService } from './cohorts.service';
import type { AcademiesService } from '../../organizations/services/academies.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { OrganizationsService } from '../../organizations/services/organizations.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import {
  EnrollmentConflictError,
  EnrollmentsRepository,
} from '../repositories/enrollments.repository';
import { EnrollmentsService } from './enrollments.service';

function fakeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: 'fellowship-1',
    cohortId: 'cohort-1',
    userId: 'user-1',
    status: 'invited',
    currentLearningTrackId: null,
    invitedAt: new Date(),
    joinedAt: null,
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
    status: 'enrolling',
    startsAt: new Date(),
    endsAt: new Date(),
    timezone: 'Africa/Lagos',
    capacity: 2,
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

function fakeCohortsService(cohort: CohortEntity): CohortsService {
  return {
    assertExists: jest.fn(async () => cohort),
    get: jest.fn(async () => cohort),
  } as unknown as CohortsService;
}

function fakeMembershipsService(isMember: boolean): MembershipsService {
  return { hasActiveMembership: jest.fn(async () => isMember) } as unknown as MembershipsService;
}

function fakeLearningTracksService(): LearningTracksService {
  return {
    get: jest.fn(
      async () => ({ id: 'track-1', fellowshipId: 'fellowship-1' }) as LearningTrackEntity,
    ),
  } as unknown as LearningTracksService;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

function fakeUsersService(): UsersService {
  return { listByIds: jest.fn(async () => []) } as unknown as UsersService;
}

function fakeOrganizationsService(): OrganizationsService {
  return {
    get: jest.fn(async () => ({ id: 'org-1', name: 'Test Org' })),
  } as unknown as OrganizationsService;
}

function fakeAcademiesService(): AcademiesService {
  return {
    get: jest.fn(async () => ({ id: 'academy-1', name: 'Test Academy' })),
  } as unknown as AcademiesService;
}

function fakeFellowshipsService(): FellowshipsService {
  return {
    get: jest.fn(async () => ({ id: 'fellowship-1', title: 'Test Fellowship' })),
  } as unknown as FellowshipsService;
}

describe('EnrollmentsService', () => {
  it('rejects enrolling a user who is not an active member of the organization', async () => {
    const repository: Partial<EnrollmentsRepository> = {};
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(false),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.create({ organizationId: 'org-1' }, 'cohort-1', 'user-1', 'actor-1'),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects enrolling once the cohort has reached capacity', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      countActiveForCohort: jest.fn(async () => 2),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort({ capacity: 2 })),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.create({ organizationId: 'org-1' }, 'cohort-1', 'user-1', 'actor-1'),
    ).rejects.toMatchObject({ response: { code: 'CAPACITY_REACHED' } });
  });

  it('translates the database partial-unique-index violation into ACTIVE_ENROLLMENT_EXISTS', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      countActiveForCohort: jest.fn(async () => 0),
      create: jest.fn(async () => {
        throw new EnrollmentConflictError();
      }),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.create({ organizationId: 'org-1' }, 'cohort-1', 'user-1', 'actor-1'),
    ).rejects.toMatchObject({ response: { code: 'ACTIVE_ENROLLMENT_EXISTS' } });
  });

  it('only allows the documented enrollment transitions (never completed -> active)', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async (scope) =>
        scope.organizationId === 'org-1' ? fakeEnrollment({ status: 'completed' }) : null,
      ),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.update({ organizationId: 'org-1' }, 'enrollment-1', { status: 'active' }, 1),
    ).rejects.toMatchObject({ response: { code: 'INVALID_STATE_TRANSITION' } });
  });

  it('treats an enrollment from another organization as not found', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async (scope) =>
        scope.organizationId === 'org-1' ? fakeEnrollment() : null,
      ),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(service.get({ organizationId: 'org-2' }, 'enrollment-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('rejects selecting a learning track that belongs to a different fellowship', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async () => fakeEnrollment({ fellowshipId: 'fellowship-1' })),
    };
    const learningTracksService = {
      get: jest.fn(
        async () =>
          ({ id: 'track-1', fellowshipId: 'a-different-fellowship' }) as LearningTrackEntity,
      ),
    } as unknown as LearningTracksService;
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      learningTracksService,
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.update(
        { organizationId: 'org-1' },
        'enrollment-1',
        { currentLearningTrackId: 'track-1' },
        1,
      ),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('allows selecting a learning track that belongs to the enrollments own fellowship, without a status change', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async () => fakeEnrollment({ fellowshipId: 'fellowship-1' })),
      update: jest.fn(async () =>
        fakeEnrollment({ currentLearningTrackId: 'track-1', version: 2 }),
      ),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.update(
        { organizationId: 'org-1' },
        'enrollment-1',
        { currentLearningTrackId: 'track-1' },
        1,
      ),
    ).resolves.toMatchObject({ currentLearningTrackId: 'track-1' });
  });

  it('listMine only ever queries by the callers own userId, never a generic list', async () => {
    const findByUserId = jest.fn(async () => ({
      rows: [fakeEnrollment({ userId: 'student-1' })],
      hasMore: false,
    }));
    const repository: Partial<EnrollmentsRepository> = { findByUserId };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    const result = await service.listMine({ organizationId: 'org-1' }, 'student-1', {});
    expect(findByUserId).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'student-1',
      expect.objectContaining({ limit: expect.any(Number) }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('listMine resolves the full Organization/Academy/Fellowship/Cohort/Track hierarchy by name', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findByUserId: jest.fn(async () => ({
        rows: [fakeEnrollment({ userId: 'student-1', currentLearningTrackId: 'track-1' })],
        hasMore: false,
      })),
    };
    const learningTracksService = {
      get: jest.fn(async () => ({ id: 'track-1', name: 'Web Development' })),
    } as unknown as LearningTracksService;
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      learningTracksService,
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    const result = await service.listMine({ organizationId: 'org-1' }, 'student-1', {});
    expect(result.items[0]).toMatchObject({
      organizationName: 'Test Org',
      academyName: 'Test Academy',
      fellowshipTitle: 'Test Fellowship',
      cohortName: 'Cohort 2027',
      currentLearningTrackName: 'Web Development',
    });
  });

  it('listMine leaves currentLearningTrackName null and never calls the tracks service when no track is set', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findByUserId: jest.fn(async () => ({
        rows: [fakeEnrollment({ userId: 'student-1', currentLearningTrackId: null })],
        hasMore: false,
      })),
    };
    const learningTracksService = { get: jest.fn() } as unknown as LearningTracksService;
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      learningTracksService,
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    const result = await service.listMine({ organizationId: 'org-1' }, 'student-1', {});
    expect(result.items[0].currentLearningTrackName).toBeNull();
    expect(learningTracksService.get).not.toHaveBeenCalled();
  });

  it('listMine degrades one enrollment to all-null hierarchy names, rather than failing the whole call, when a parent has since been hard-deleted', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findByUserId: jest.fn(async () => ({
        rows: [fakeEnrollment({ userId: 'student-1' })],
        hasMore: false,
      })),
    };
    const academiesService = {
      get: jest.fn(async () => {
        throw new Error('Academy not found.');
      }),
    } as unknown as AcademiesService;
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      academiesService,
      fakeFellowshipsService(),
    );

    const result = await service.listMine({ organizationId: 'org-1' }, 'student-1', {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      organizationName: null,
      academyName: null,
      fellowshipTitle: null,
      cohortName: null,
      currentLearningTrackName: null,
    });
  });
});

describe('EnrollmentsService.selectTrack — self-service pick/switch', () => {
  it("rejects a caller who is not the enrollment's own student", async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async () => fakeEnrollment({ userId: 'student-1' })),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.selectTrack({ organizationId: 'org-1' }, 'enrollment-1', 'track-1', 'someone-else'),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });

  it('always allows a first-time pick, even if the cohort has closed track switching', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async () =>
        fakeEnrollment({ userId: 'student-1', currentLearningTrackId: null }),
      ),
      update: jest.fn(async () =>
        fakeEnrollment({ currentLearningTrackId: 'track-1', version: 2 }),
      ),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort({ trackSwitchClosedAt: new Date() })),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.selectTrack({ organizationId: 'org-1' }, 'enrollment-1', 'track-1', 'student-1'),
    ).resolves.toMatchObject({ currentLearningTrackId: 'track-1' });
    expect(repository.update).toHaveBeenCalled();
  });

  it('allows switching an already-set track while the cohort keeps switching open', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async () =>
        fakeEnrollment({ userId: 'student-1', currentLearningTrackId: 'track-1' }),
      ),
      update: jest.fn(async () =>
        fakeEnrollment({ currentLearningTrackId: 'track-2', version: 2 }),
      ),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort({ trackSwitchClosedAt: null })),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.selectTrack({ organizationId: 'org-1' }, 'enrollment-1', 'track-1', 'student-1'),
    ).resolves.toBeDefined();
  });

  it('rejects switching away from an already-set track once the cohort has closed switching', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async () =>
        fakeEnrollment({ userId: 'student-1', currentLearningTrackId: 'track-1' }),
      ),
      update: jest.fn(),
    };
    const learningTracksService = {
      get: jest.fn(async () => ({ id: 'track-2', fellowshipId: 'fellowship-1' })),
    } as unknown as LearningTracksService;
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort({ trackSwitchClosedAt: new Date() })),
      fakeMembershipsService(true),
      learningTracksService,
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.selectTrack({ organizationId: 'org-1' }, 'enrollment-1', 'track-2', 'student-1'),
    ).rejects.toMatchObject({ response: { code: 'TRACK_SWITCHING_CLOSED' } });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('is a no-op (no repository write) when re-selecting the already-current track', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async () =>
        fakeEnrollment({ userId: 'student-1', currentLearningTrackId: 'track-1' }),
      ),
      update: jest.fn(),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort({ trackSwitchClosedAt: new Date() })),
      fakeMembershipsService(true),
      fakeLearningTracksService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.selectTrack({ organizationId: 'org-1' }, 'enrollment-1', 'track-1', 'student-1'),
    ).resolves.toMatchObject({ currentLearningTrackId: 'track-1' });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects a track that does not belong to the enrollments own fellowship', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async () =>
        fakeEnrollment({ userId: 'student-1', fellowshipId: 'fellowship-1' }),
      ),
    };
    const learningTracksService = {
      get: jest.fn(async () => ({ id: 'track-1', fellowshipId: 'a-different-fellowship' })),
    } as unknown as LearningTracksService;
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      learningTracksService,
      fakeAuditLog(),
      fakeUsersService(),
      fakeOrganizationsService(),
      fakeAcademiesService(),
      fakeFellowshipsService(),
    );

    await expect(
      service.selectTrack({ organizationId: 'org-1' }, 'enrollment-1', 'track-1', 'student-1'),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
});
