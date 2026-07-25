import type { Organization } from '@prisma/client';
import type { AuditLogService } from '../../platform/audit-log.service';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import type { PermissionResolverService } from './permission-resolver.service';
import { OrganizationsService } from './organizations.service';

function fakeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Tech Impact',
    slug: 'tech-impact',
    status: 'active',
    legalName: null,
    defaultTimezone: 'Africa/Lagos',
    country: null,
    dataRegion: 'africa-west',
    supportEmail: null,
    customDomain: null,
    logoAssetId: null,
    branding: null,
    settings: null,
    settingsVersion: 1,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakePermissionResolver(isSuperAdmin: boolean): PermissionResolverService {
  return {
    hasPlatformRole: jest.fn(async () => isSuperAdmin),
  } as unknown as PermissionResolverService;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

describe('OrganizationsService', () => {
  it('rejects GET /organizations (platform list) for a non Super Admin, even with an org-scoped permission grant', async () => {
    const repository: Partial<OrganizationsRepository> = {
      list: jest.fn(async () => ({ rows: [fakeOrganization()], hasMore: false })),
    };
    const service = new OrganizationsService(
      repository as OrganizationsRepository,
      fakePermissionResolver(false),
      fakeAuditLog(),
    );

    await expect(service.list('user-1', {})).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  });

  it('allows a Super Admin to list organizations', async () => {
    const repository: Partial<OrganizationsRepository> = {
      list: jest.fn(async () => ({ rows: [fakeOrganization()], hasMore: false })),
    };
    const service = new OrganizationsService(
      repository as OrganizationsRepository,
      fakePermissionResolver(true),
      fakeAuditLog(),
    );

    const result = await service.list('user-1', {});
    expect(result.items).toHaveLength(1);
  });

  it("treats a non-super-admin caller's mismatched org scope as not found on GET /organizations/:orgId", async () => {
    const repository: Partial<OrganizationsRepository> = {
      findById: jest.fn(async () => fakeOrganization({ id: 'org-1' })),
    };
    const service = new OrganizationsService(
      repository as OrganizationsRepository,
      fakePermissionResolver(false),
      fakeAuditLog(),
    );

    await expect(service.get('user-1', 'org-2', 'org-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    await expect(service.get('user-1', undefined, 'org-1')).resolves.toMatchObject({ id: 'org-1' });
  });

  it("does not reject a Super Admin's own active-org header when reading a different organization", async () => {
    // Regression: a Super Admin browsing Organizations while their own
    // "active org" (X-Organization-Id) is set to an unrelated tenant must
    // still be able to read/manage any organization by id.
    const repository: Partial<OrganizationsRepository> = {
      findById: jest.fn(async () => fakeOrganization({ id: 'org-1' })),
    };
    const service = new OrganizationsService(
      repository as OrganizationsRepository,
      fakePermissionResolver(true),
      fakeAuditLog(),
    );

    await expect(service.get('super-admin-1', 'org-2', 'org-1')).resolves.toMatchObject({
      id: 'org-1',
    });
  });

  it('rejects suspend/archive/restore for a non Super Admin', async () => {
    const repository: Partial<OrganizationsRepository> = {};
    const service = new OrganizationsService(
      repository as OrganizationsRepository,
      fakePermissionResolver(false),
      fakeAuditLog(),
    );

    await expect(service.suspend('user-1', 'org-1')).rejects.toMatchObject({
      response: { code: 'PERMISSION_DENIED' },
    });
  });
});
