import type { MembershipRole } from '@prisma/client';
import type { MembershipsRepository } from '../repositories/memberships.repository';
import { PermissionResolverService } from './permission-resolver.service';

function fakeMembershipsRepository(options: {
  permissionKeys?: string[];
  platformGrants?: MembershipRole[];
}) {
  const repo: Partial<MembershipsRepository> = {
    findPermissionKeys: jest.fn(async () => new Set(options.permissionKeys ?? [])),
    findPlatformRoleGrants: jest.fn(async () => options.platformGrants ?? []),
  };
  return repo as MembershipsRepository;
}

describe('PermissionResolverService', () => {
  it('grants access when the user holds the required permission in the active organization', async () => {
    const service = new PermissionResolverService(
      fakeMembershipsRepository({ permissionKeys: ['role.read'] }),
    );
    await expect(service.hasPermission('user-1', 'org-1', 'role.read')).resolves.toBe(true);
    await expect(service.hasPermission('user-1', 'org-1', 'role.delete')).resolves.toBe(false);
  });

  it('a platform SUPER_ADMIN grant bypasses organization-scoped permission checks entirely', async () => {
    const service = new PermissionResolverService(
      fakeMembershipsRepository({
        permissionKeys: [], // no explicit grant in this organization
        platformGrants: [{ id: 'grant-1' } as MembershipRole],
      }),
    );
    await expect(service.hasPermission('user-1', 'org-1', 'role.delete')).resolves.toBe(true);
  });

  it('denies access when the user has no membership or grant at all', async () => {
    const service = new PermissionResolverService(fakeMembershipsRepository({}));
    await expect(service.hasPermission('user-1', 'org-1', 'user.read')).resolves.toBe(false);
  });
});
