import { Injectable } from '@nestjs/common';
import type { Membership, MembershipRole, Role } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export type MembershipWithRoles = Membership & {
  membershipRoles: (MembershipRole & { role: Role })[];
};

const ACTIVE_ROLES_INCLUDE = {
  membershipRoles: { where: { revokedAt: null } as const, include: { role: true } },
};

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(scope: TenantScope, userId: string): Promise<MembershipWithRoles | null> {
    return this.prisma.membership.findFirst({
      where: {
        organizationId: scope.organizationId,
        userId,
        status: { in: ['active', 'invited'] },
      },
      include: ACTIVE_ROLES_INCLUDE,
    });
  }

  findById(scope: TenantScope, id: string): Promise<MembershipWithRoles | null> {
    return this.prisma.membership.findFirst({
      where: { id, organizationId: scope.organizationId },
      include: ACTIVE_ROLES_INCLUDE,
    });
  }

  /** Union of permission keys granted by every active role on the caller's
   * active membership within `scope`. */
  async findPermissionKeys(scope: TenantScope, userId: string): Promise<Set<string>> {
    const grants = await this.prisma.membershipRole.findMany({
      where: {
        revokedAt: null,
        membership: {
          organizationId: scope.organizationId,
          userId,
          status: { in: ['active', 'invited'] },
        },
      },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const keys = new Set<string>();
    for (const grant of grants) {
      for (const rolePermission of grant.role.rolePermissions) {
        keys.add(rolePermission.permission.key);
      }
    }
    return keys;
  }

  /** All active memberships for a user across every organization — used to
   * resolve platform-scoped grants (e.g. SUPER_ADMIN) that apply beyond a
   * single tenant, and for the self-service `/users/:userId/memberships` view. */
  listForUser(userId: string): Promise<MembershipWithRoles[]> {
    return this.prisma.membership.findMany({
      where: { userId },
      include: { membershipRoles: { where: { revokedAt: null }, include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(scope: TenantScope, userId: string): Promise<Membership> {
    return this.prisma.membership.create({
      data: { organizationId: scope.organizationId, userId, status: 'invited' },
    });
  }

  updateStatus(
    scope: TenantScope,
    id: string,
    status: 'active' | 'suspended' | 'ended',
  ): Promise<Membership> {
    return this.prisma.membership.update({
      where: { id },
      data: {
        status,
        ...(status === 'active' ? { joinedAt: new Date() } : {}),
        ...(status === 'ended' ? { endedAt: new Date() } : {}),
      },
    });
  }

  grantRole(membershipId: string, roleId: string, grantedBy?: string): Promise<MembershipRole> {
    return this.prisma.membershipRole.create({ data: { membershipId, roleId, grantedBy } });
  }

  revokeRole(membershipId: string, roleId: string): Promise<{ count: number }> {
    return this.prisma.membershipRole.updateMany({
      where: { membershipId, roleId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Platform-scoped role grants (e.g. SUPER_ADMIN) held anywhere, regardless
   * of which organization the carrying membership belongs to. */
  findPlatformRoleGrants(userId: string, roleKey: string): Promise<MembershipRole[]> {
    return this.prisma.membershipRole.findMany({
      where: {
        revokedAt: null,
        role: { key: roleKey, scopeType: 'platform' },
        membership: { userId },
      },
    });
  }
}
