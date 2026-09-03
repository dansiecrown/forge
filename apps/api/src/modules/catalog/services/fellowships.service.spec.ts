import type { AcademyEntity } from '../../organizations/entities/academy.entity';
import type { AcademiesService } from '../../organizations/services/academies.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { Fellowship } from '@prisma/client';
import { FellowshipsRepository } from '../repositories/fellowships.repository';
import { FellowshipsService } from './fellowships.service';

function fakeFellowship(overrides: Partial<Fellowship> = {}): Fellowship {
  return {
    id: 'fellowship-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    title: 'Tech Impact Fellowship',
    slug: 'tech-impact',
    status: 'draft',
    durationWeeks: 24,
    description: null,
    summary: null,
    defaultCapacity: null,
    isPublic: false,
    registrationOpensAt: null,
    registrationClosesAt: null,
    eligibilityMetadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function fakeAcademiesService(): AcademiesService {
  return {
    assertBelongsToScope: jest.fn(async () => ({}) as AcademyEntity),
  } as unknown as AcademiesService;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

/** Defaults to org-wide (unrestricted) access — matches Super Admin/Org
 * Admin, the common case for existing tests. */
function fakeMembershipsService(overrides: Partial<MembershipsService> = {}): MembershipsService {
  return {
    getAcademyScope: jest.fn(async () => ({ restricted: false, academyId: null })),
    ...overrides,
  } as unknown as MembershipsService;
}

describe('FellowshipsService', () => {
  it('treats a fellowship from another organization as not found, never forbidden', async () => {
    const repository: Partial<FellowshipsRepository> = {
      findById: jest.fn(async (scope) =>
        scope.organizationId === 'org-1' ? fakeFellowship() : null,
      ),
    };
    const service = new FellowshipsService(
      repository as FellowshipsRepository,
      fakeAcademiesService(),
      fakeAuditLog(),
      fakeMembershipsService(),
    );

    await expect(
      service.get({ organizationId: 'org-2' }, 'fellowship-1', 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it("treats a fellowship outside an Academy Admin's own academy as not found", async () => {
    const repository: Partial<FellowshipsRepository> = {
      findById: jest.fn(async () => fakeFellowship({ academyId: 'academy-2' })),
    };
    const service = new FellowshipsService(
      repository as FellowshipsRepository,
      fakeAcademiesService(),
      fakeAuditLog(),
      fakeMembershipsService({
        getAcademyScope: jest.fn(async () => ({ restricted: true, academyId: 'academy-1' })),
      }),
    );

    await expect(
      service.get({ organizationId: 'org-1' }, 'fellowship-1', 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('blocks creating a cohort under a retired fellowship', async () => {
    const repository: Partial<FellowshipsRepository> = {
      findById: jest.fn(async () => fakeFellowship({ status: 'retired' })),
    };
    const service = new FellowshipsService(
      repository as FellowshipsRepository,
      fakeAcademiesService(),
      fakeAuditLog(),
      fakeMembershipsService(),
    );

    await expect(
      service.assertOpenForCohortCreation({ organizationId: 'org-1' }, 'fellowship-1', 'caller-1'),
    ).rejects.toMatchObject({ response: { code: 'FELLOWSHIP_RETIRED' } });
  });

  it('only allows draft -> published -> retired, never published -> draft', async () => {
    const repository: Partial<FellowshipsRepository> = {
      findById: jest.fn(async () => fakeFellowship({ status: 'published' })),
      updateStatus: jest.fn(async () => fakeFellowship({ status: 'retired', version: 2 })),
    };
    const service = new FellowshipsService(
      repository as FellowshipsRepository,
      fakeAcademiesService(),
      fakeAuditLog(),
      fakeMembershipsService(),
    );

    await expect(
      service.publish({ organizationId: 'org-1' }, 'fellowship-1', 1, 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_STATE_TRANSITION' },
    });
    await expect(
      service.retire({ organizationId: 'org-1' }, 'fellowship-1', 1, 'caller-1'),
    ).resolves.toMatchObject({ status: 'retired' });
  });
});
