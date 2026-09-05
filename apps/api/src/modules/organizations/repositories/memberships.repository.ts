import { Injectable } from '@nestjs/common';
import type { Membership, MembershipRole, Role, User } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export type MembershipWithRoles = Membership & {
  membershipRoles: (MembershipRole & { role: Role })[];
};

export type MembershipWithUser = Membership & { user: User };

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

  /** Any membership row for this (organization, user) pair, regardless of
   * status — used to decide whether an invitation should create a new
   * membership or reject as already-a-member, before hitting the unique
   * constraint on (organization_id, user_id). */
  findByOrganizationAndUser(organizationId: string, userId: string): Promise<Membership | null> {
    return this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
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

  /** Active memberships in this organization holding the given role key —
   * used by the Organization Management "organization administrators" list. */
  /** Includes `user` (unlike the shared `ACTIVE_ROLES_INCLUDE`) — its one
   * caller, the "organization administrators" list, must show a name, never
   * a bare id (docs/adr/0015-name-first-display.md). */
  listByRoleKey(scope: TenantScope, roleKey: string): Promise<MembershipWithUser[]> {
    return this.prisma.membership.findMany({
      where: {
        organizationId: scope.organizationId,
        membershipRoles: { some: { revokedAt: null, role: { key: roleKey } } },
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Membership-status and role-grant counts for the "membership overview"
   * summary — two light `groupBy` queries, no new aggregation table. */
  async getOverview(
    scope: TenantScope,
  ): Promise<{ total: number; byStatus: Record<string, number>; byRole: Record<string, number> }> {
    const [total, byStatusRows, byRoleRows] = await Promise.all([
      this.prisma.membership.count({ where: { organizationId: scope.organizationId } }),
      this.prisma.membership.groupBy({
        by: ['status'],
        where: { organizationId: scope.organizationId },
        _count: true,
      }),
      this.prisma.membershipRole.groupBy({
        by: ['roleId'],
        where: { revokedAt: null, membership: { organizationId: scope.organizationId } },
        _count: true,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRows) {
      byStatus[row.status] = row._count;
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: byRoleRows.map((r) => r.roleId) } },
    });
    const roleKeyById = new Map(roles.map((r) => [r.id, r.key]));
    const byRole: Record<string, number> = {};
    for (const row of byRoleRows) {
      const key = roleKeyById.get(row.roleId) ?? row.roleId;
      byRole[key] = row._count;
    }

    return { total, byStatus, byRole };
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
