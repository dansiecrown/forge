import type { Cohort } from '@prisma/client';
import type { FellowshipEntity } from '../../catalog/entities/fellowship.entity';
import type { FellowshipsService } from '../../catalog/services/fellowships.service';
import type { CurriculumSnapshotService } from '../../catalog/services/curriculum-snapshot.service';
import type { LearningTracksService } from '../../catalog/services/learning-tracks.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { UsersService } from '../../identity/services/users.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import { CohortsRepository, CohortVersionConflictError } from '../repositories/cohorts.repository';
import { CohortsService } from './cohorts.service';

function fakeCohort(overrides: Partial<Cohort> = {}): Cohort {
  return {
    id: 'cohort-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: 'fellowship-1',
    name: 'Cohort 2027',
    slug: 'cohort-2027',
    status: 'draft',
    startsAt: new Date('2027-01-01T00:00:00Z'),
    endsAt: new Date('2027-06-01T00:00:00Z'),
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
    deletedAt: null,
    ...overrides,
  };
}

function fakeFellowshipsService(status: string = 'published'): FellowshipsService {
  return {
    assertOpenForCohortCreation: jest.fn(
      async () =>
        ({
          academyId: 'academy-1',
          status,
        }) as FellowshipEntity,
    ),
  } as unknown as FellowshipsService;
}

/** Defaults to org-wide (unrestricted) access — matches Super Admin/Org
 * Admin, the common case for existing tests. */
function fakeMembershipsService(overrides: Partial<MembershipsService> = {}): MembershipsService {
  return {
    getAcademyScope: jest.fn(async () => ({ restricted: false, academyId: null })),
    ...overrides,
  } as unknown as MembershipsService;
}

function fakeCurriculumSnapshotService(): CurriculumSnapshotService {
  return {
    build: jest.fn(async () => ({
      generatedAt: new Date().toISOString(),
      fellowshipId: 'fellowship-1',
      tracks: [],
    })),
  } as unknown as CurriculumSnapshotService;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

function fakeUsersService(): UsersService {
  return {
    listByIds: jest.fn(async () => []),
    getById: jest.fn(async () => ({
      displayName: 'Test Mentor',
      emailCanonical: 'mentor@test.local',
    })),
  } as unknown as UsersService;
}

function fakeLearningTracksService(): LearningTracksService {
  return {
    get: jest.fn(async () => ({ id: 'track-1', fellowshipId: 'fellowship-1' })),
  } as unknown as LearningTracksService;
}

describe('CohortsService', () => {
  it('treats a cohort from another organization as not found', async () => {
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async (scope) => (scope.organizationId === 'org-1' ? fakeCohort() : null)),
    };
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      fakeCurriculumSnapshotService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    await expect(
      service.get({ organizationId: 'org-2' }, 'cohort-1', 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it("treats a cohort outside an Academy Admin's own academy as not found", async () => {
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async () => fakeCohort({ academyId: 'academy-2' })),
    };
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService({
        getAcademyScope: jest.fn(async () => ({ restricted: true, academyId: 'academy-1' })),
      }),
      fakeCurriculumSnapshotService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    await expect(
      service.get({ organizationId: 'org-1' }, 'cohort-1', 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('rejects a cohort where endsAt is not after startsAt', async () => {
    const repository: Partial<CohortsRepository> = {
      findBySlug: jest.fn(async () => null),
      create: jest.fn(async () => fakeCohort()),
    };
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      fakeCurriculumSnapshotService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    await expect(
      service.create(
        { organizationId: 'org-1' },
        {
          fellowshipId: 'fellowship-1',
          name: 'Cohort 2027',
          slug: 'cohort-2027',
          startsAt: '2027-06-01T00:00:00Z',
          endsAt: '2027-01-01T00:00:00Z',
          timezone: 'Africa/Lagos',
          capacity: 50,
        },
        'caller-1',
      ),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('only allows the documented lifecycle transitions (never active -> draft)', async () => {
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async () => fakeCohort({ status: 'active', version: 3 })),
      updateStatus: jest.fn(async () => fakeCohort({ status: 'paused', version: 4 })),
    };
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      fakeCurriculumSnapshotService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    await expect(
      service.activate({ organizationId: 'org-1' }, 'cohort-1', 3, 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_STATE_TRANSITION' },
    });
    await expect(
      service.pause({ organizationId: 'org-1' }, 'cohort-1', 3, 'caller-1'),
    ).resolves.toMatchObject({
      status: 'paused',
    });
  });

  it('rejects a transition action carrying a stale version', async () => {
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async () => fakeCohort({ status: 'active', version: 3 })),
    };
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      fakeCurriculumSnapshotService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    await expect(
      service.pause({ organizationId: 'org-1' }, 'cohort-1', 1, 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'VERSION_CONFLICT' },
    });
  });

  // Core of the versioning resolution (docs/adr/0006-curriculum-learning-engine.md
  // Decision 1): editing curriculum never touches an existing cohort's frozen
  // snapshot unless this action is explicitly called.
  it('overwrites the stored snapshot only when sync-curriculum is explicitly called', async () => {
    const staleSnapshot = { generatedAt: 'stale', fellowshipId: 'fellowship-1', tracks: [] };
    const freshSnapshot = { generatedAt: 'fresh', fellowshipId: 'fellowship-1', tracks: [] };
    const updateCurriculumSnapshot = jest.fn(async () =>
      fakeCohort({ curriculumSnapshot: freshSnapshot, version: 2 }),
    );
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async () => fakeCohort({ curriculumSnapshot: staleSnapshot, version: 1 })),
      updateCurriculumSnapshot,
    };
    const curriculumSnapshotService = {
      build: jest.fn(async () => freshSnapshot),
    } as unknown as CurriculumSnapshotService;
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      curriculumSnapshotService,
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    const result = await service.syncCurriculum(
      { organizationId: 'org-1' },
      'cohort-1',
      1,
      'caller-1',
    );

    expect(updateCurriculumSnapshot).toHaveBeenCalledWith('cohort-1', freshSnapshot);
    expect(result.curriculumSnapshot).toEqual(freshSnapshot);
  });

  it('rejects a sync-curriculum call carrying a stale version', async () => {
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async () => fakeCohort({ version: 3 })),
    };
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      fakeCurriculumSnapshotService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    await expect(
      service.syncCurriculum({ organizationId: 'org-1' }, 'cohort-1', 1, 'caller-1'),
    ).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
  });
});

describe('CohortsService — track switch grace period', () => {
  it('closeTrackSwitching sets trackSwitchClosedAt and audit-logs it', async () => {
    const update = jest.fn(async () => fakeCohort({ trackSwitchClosedAt: new Date(), version: 2 }));
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async () => fakeCohort({ version: 1 })),
      update,
    };
    const auditLog = fakeAuditLog();
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      fakeCurriculumSnapshotService(),
      auditLog,
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    const result = await service.closeTrackSwitching(
      { organizationId: 'org-1' },
      'cohort-1',
      1,
      'caller-1',
    );

    expect(result.trackSwitchClosedAt).not.toBeNull();
    expect(update).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'cohort-1',
      { trackSwitchClosedAt: expect.any(Date) },
      1,
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cohort.track_switching_closed' }),
    );
  });

  it('reopenTrackSwitching clears trackSwitchClosedAt', async () => {
    const update = jest.fn(async () => fakeCohort({ trackSwitchClosedAt: null, version: 2 }));
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async () => fakeCohort({ trackSwitchClosedAt: new Date(), version: 1 })),
      update,
    };
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      fakeCurriculumSnapshotService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    const result = await service.reopenTrackSwitching(
      { organizationId: 'org-1' },
      'cohort-1',
      1,
      'caller-1',
    );

    expect(result.trackSwitchClosedAt).toBeNull();
    expect(update).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'cohort-1',
      { trackSwitchClosedAt: null },
      1,
    );
  });

  it('rejects closing with a stale version', async () => {
    const repository: Partial<CohortsRepository> = {
      findById: jest.fn(async () => fakeCohort({ version: 3 })),
      update: jest.fn(async () => {
        throw new CohortVersionConflictError(3);
      }),
    };
    const service = new CohortsService(
      repository as CohortsRepository,
      fakeFellowshipsService(),
      fakeMembershipsService(),
      fakeCurriculumSnapshotService(),
      fakeAuditLog(),
      fakeUsersService(),
      fakeLearningTracksService(),
    );

    await expect(
      service.closeTrackSwitching({ organizationId: 'org-1' }, 'cohort-1', 1, 'caller-1'),
    ).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
  });
});
