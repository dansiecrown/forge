import type { MembershipWithRoles } from '../repositories/memberships.repository';
import { MembershipsRepository } from '../repositories/memberships.repository';
import { RolesRepository } from '../repositories/roles.repository';
import type { AuditLogService } from '../../platform/audit-log.service';
import { PermissionResolverService } from './permission-resolver.service';
import { MembershipsService } from './memberships.service';

function fakeMembership(
  scopeTypes: ('platform' | 'organization' | 'academy')[],
  academyId: string | null = null,
): MembershipWithRoles {
  return {
    id: 'membership-1',
    organizationId: 'org-1',
    userId: 'user-1',
    academyId,
    status: 'active',
    invitedAt: new Date(),
    joinedAt: new Date(),
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    membershipRoles: scopeTypes.map((scopeType, index) => ({
      id: `membership-role-${index}`,
      membershipId: 'membership-1',
      roleId: `role-${index}`,
      grantedBy: null,
      grantedAt: new Date(),
      revokedAt: null,
      role: {
        id: `role-${index}`,
        key: 'SOME_ROLE',
        name: 'Some Role',
        scopeType,
        status: 'active',
        organizationId: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })) as never,
  } as unknown as MembershipWithRoles;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

describe('MembershipsService.getAcademyScope', () => {
  it('is unrestricted for a platform Super Admin', async () => {
    const membershipsRepository: Partial<MembershipsRepository> = {
      findActive: jest.fn(async () => fakeMembership(['academy'], 'academy-1')),
    };
    const permissionResolver: Partial<PermissionResolverService> = {
      hasPlatformRole: jest.fn(async () => true),
    };
    const service = new MembershipsService(
      membershipsRepository as MembershipsRepository,
      {} as RolesRepository,
      fakeAuditLog(),
      permissionResolver as PermissionResolverService,
    );

    await expect(service.getAcademyScope({ organizationId: 'org-1' }, 'user-1')).resolves.toEqual({
      restricted: false,
      academyId: null,
    });
  });

  it('is unrestricted for an organization-scoped role (e.g. ORG_ADMIN)', async () => {
    const membershipsRepository: Partial<MembershipsRepository> = {
      findActive: jest.fn(async () => fakeMembership(['organization'])),
    };
    const permissionResolver: Partial<PermissionResolverService> = {
      hasPlatformRole: jest.fn(async () => false),
    };
    const service = new MembershipsService(
      membershipsRepository as MembershipsRepository,
      {} as RolesRepository,
      fakeAuditLog(),
      permissionResolver as PermissionResolverService,
    );

    await expect(service.getAcademyScope({ organizationId: 'org-1' }, 'user-1')).resolves.toEqual({
      restricted: false,
      academyId: null,
    });
  });

  it('confines an academy-scoped role (e.g. ACADEMY_ADMIN) to its anchored academy', async () => {
    const membershipsRepository: Partial<MembershipsRepository> = {
      findActive: jest.fn(async () => fakeMembership(['academy'], 'academy-1')),
    };
    const permissionResolver: Partial<PermissionResolverService> = {
      hasPlatformRole: jest.fn(async () => false),
    };
    const service = new MembershipsService(
      membershipsRepository as MembershipsRepository,
      {} as RolesRepository,
      fakeAuditLog(),
      permissionResolver as PermissionResolverService,
    );

    await expect(service.getAcademyScope({ organizationId: 'org-1' }, 'user-1')).resolves.toEqual({
      restricted: true,
      academyId: 'academy-1',
    });
  });

  it('sees nothing for an academy-scoped role never anchored to an academy', async () => {
    const membershipsRepository: Partial<MembershipsRepository> = {
      findActive: jest.fn(async () => fakeMembership(['academy'], null)),
    };
    const permissionResolver: Partial<PermissionResolverService> = {
      hasPlatformRole: jest.fn(async () => false),
    };
    const service = new MembershipsService(
      membershipsRepository as MembershipsRepository,
      {} as RolesRepository,
      fakeAuditLog(),
      permissionResolver as PermissionResolverService,
    );

    await expect(service.getAcademyScope({ organizationId: 'org-1' }, 'user-1')).resolves.toEqual({
      restricted: true,
      academyId: null,
    });
  });

  it('sees nothing when the caller has no active membership in scope', async () => {
    const membershipsRepository: Partial<MembershipsRepository> = {
      findActive: jest.fn(async () => null),
    };
    const permissionResolver: Partial<PermissionResolverService> = {
      hasPlatformRole: jest.fn(async () => false),
    };
    const service = new MembershipsService(
      membershipsRepository as MembershipsRepository,
      {} as RolesRepository,
      fakeAuditLog(),
      permissionResolver as PermissionResolverService,
    );

    await expect(service.getAcademyScope({ organizationId: 'org-1' }, 'user-1')).resolves.toEqual({
      restricted: true,
      academyId: null,
    });
  });
});
