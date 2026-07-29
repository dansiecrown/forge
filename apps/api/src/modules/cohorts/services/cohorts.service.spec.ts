import type { Cohort } from '@prisma/client';
import type { FellowshipEntity } from '../../catalog/entities/fellowship.entity';
import type { FellowshipsService } from '../../catalog/services/fellowships.service';
import type { CurriculumSnapshotService } from '../../catalog/services/curriculum-snapshot.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import { CohortsRepository } from '../repositories/cohorts.repository';
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

function fakeMembershipsService(): MembershipsService {
  return {} as unknown as MembershipsService;
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
    );

    await expect(service.get({ organizationId: 'org-2' }, 'cohort-1')).rejects.toMatchObject({
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
    );

    await expect(
      service.activate({ organizationId: 'org-1' }, 'cohort-1', 3),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_STATE_TRANSITION' },
    });
    await expect(service.pause({ organizationId: 'org-1' }, 'cohort-1', 3)).resolves.toMatchObject({
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
    );

    await expect(service.pause({ organizationId: 'org-1' }, 'cohort-1', 1)).rejects.toMatchObject({
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
    );

    const result = await service.syncCurriculum({ organizationId: 'org-1' }, 'cohort-1', 1);

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
    );

    await expect(
      service.syncCurriculum({ organizationId: 'org-1' }, 'cohort-1', 1),
    ).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
  });
});
