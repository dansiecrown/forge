import type { Academy } from '@prisma/client';
import type { AuditLogService } from '../../platform/audit-log.service';
import { AcademiesRepository } from '../repositories/academies.repository';
import type { MembershipsService } from './memberships.service';
import { AcademiesService } from './academies.service';

function fakeAcademy(overrides: Partial<Academy> = {}): Academy {
  return {
    id: 'academy-1',
    organizationId: 'org-1',
    name: 'School of Technology',
    slug: 'technology',
    status: 'active',
    description: null,
    timezone: 'Africa/Lagos',
    branding: null,
    contactEmail: null,
    isPublic: false,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
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

describe('AcademiesService', () => {
  it('treats an academy from another organization as not found', async () => {
    const repository: Partial<AcademiesRepository> = {
      findById: jest.fn(async (scope) => (scope.organizationId === 'org-1' ? fakeAcademy() : null)),
    };
    const service = new AcademiesService(
      repository as AcademiesRepository,
      fakeAuditLog(),
      fakeMembershipsService(),
    );

    await expect(
      service.get({ organizationId: 'org-2' }, 'academy-1', 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it("treats an academy outside an Academy Admin's own academy as not found", async () => {
    const repository: Partial<AcademiesRepository> = {
      findById: jest.fn(async () => fakeAcademy({ id: 'academy-2' })),
    };
    const service = new AcademiesService(
      repository as AcademiesRepository,
      fakeAuditLog(),
      fakeMembershipsService({
        getAcademyScope: jest.fn(async () => ({ restricted: true, academyId: 'academy-1' })),
      }),
    );

    await expect(
      service.get({ organizationId: 'org-1' }, 'academy-2', 'caller-1'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('allows an Academy Admin to read their own academy', async () => {
    const repository: Partial<AcademiesRepository> = {
      findById: jest.fn(async () => fakeAcademy({ id: 'academy-1' })),
    };
    const service = new AcademiesService(
      repository as AcademiesRepository,
      fakeAuditLog(),
      fakeMembershipsService({
        getAcademyScope: jest.fn(async () => ({ restricted: true, academyId: 'academy-1' })),
      }),
    );

    await expect(
      service.get({ organizationId: 'org-1' }, 'academy-1', 'caller-1'),
    ).resolves.toMatchObject({ id: 'academy-1' });
  });

  it('rejects creating an academy whose slug is already taken in the organization', async () => {
    const repository: Partial<AcademiesRepository> = {
      findBySlug: jest.fn(async () => fakeAcademy()),
    };
    const service = new AcademiesService(
      repository as AcademiesRepository,
      fakeAuditLog(),
      fakeMembershipsService(),
    );

    await expect(
      service.create(
        { organizationId: 'org-1' },
        { name: 'School of Technology', slug: 'technology' },
      ),
    ).rejects.toMatchObject({ response: { code: 'SLUG_TAKEN' } });
  });
});
