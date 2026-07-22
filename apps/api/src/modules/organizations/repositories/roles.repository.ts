import { Injectable } from '@nestjs/common';
import type { Permission, Role } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type RoleWithPermissions = Role & { rolePermissions: { permission: Permission }[] };

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  findByKey(key: string): Promise<Role | null> {
    return this.prisma.role.findFirst({ where: { key, deletedAt: null } });
  }

  /** System roles (organizationId null) plus any custom roles for the tenant. */
  listForOrganization(organizationId: string): Promise<RoleWithPermissions[]> {
    return this.prisma.role.findMany({
      where: { deletedAt: null, OR: [{ organizationId: null }, { organizationId }] },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  create(data: {
    organizationId: string | null;
    key: string;
    name: string;
    scopeType: 'platform' | 'organization' | 'academy';
    isSystem?: boolean;
    description?: string;
    permissionIds: string[];
  }): Promise<RoleWithPermissions> {
    return this.prisma.role.create({
      data: {
        organizationId: data.organizationId,
        key: data.key,
        name: data.name,
        scopeType: data.scopeType,
        isSystem: data.isSystem ?? false,
        description: data.description,
        rolePermissions: {
          create: data.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async updatePermissions(
    roleId: string,
    permissionIds: string[],
    expectedVersion: number,
  ): Promise<RoleWithPermissions> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.role.findUniqueOrThrow({ where: { id: roleId } });
      if (current.version !== expectedVersion) {
        throw new RoleVersionConflictError(current.version);
      }

      await tx.rolePermission.deleteMany({ where: { roleId } });
      return tx.role.update({
        where: { id: roleId },
        data: {
          version: { increment: 1 },
          rolePermissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
        },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  softDelete(id: string): Promise<Role> {
    return this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'retired' },
    });
  }

  countActiveAssignments(roleId: string): Promise<number> {
    return this.prisma.membershipRole.count({ where: { roleId, revokedAt: null } });
  }
}

export class RoleVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Role has been modified since it was last read.');
  }
}
