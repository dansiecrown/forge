import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { PermissionsRepository } from '../repositories/permissions.repository';
import {
  RolesRepository,
  RoleVersionConflictError,
  type RoleWithPermissions,
} from '../repositories/roles.repository';

export interface CreateRoleInput {
  name: string;
  key: string;
  permissionIds: string[];
}

@Injectable()
export class RolesService {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  list(scope: TenantScope): Promise<RoleWithPermissions[]> {
    return this.rolesRepository.listForOrganization(scope.organizationId);
  }

  /** `organizationId` is the caller's active scope (undefined only for a
   * platform SUPER_ADMIN acting without one). A defined, non-matching scope
   * is treated as not-found rather than forbidden, so a role UUID from
   * another organization can't be confirmed to exist by probing this
   * endpoint. System roles (organizationId null) are always visible. */
  async get(id: string, organizationId?: string): Promise<RoleWithPermissions> {
    const role = await this.rolesRepository.findById(id);
    if (
      !role ||
      (role.organizationId && organizationId && role.organizationId !== organizationId)
    ) {
      throw AppException.notFound('Role not found.');
    }
    return role;
  }

  async create(
    scope: TenantScope,
    input: CreateRoleInput,
    actorUserId?: string,
  ): Promise<RoleWithPermissions> {
    await this.assertPermissionsExist(input.permissionIds);
    const role = await this.rolesRepository.create({
      organizationId: scope.organizationId,
      key: input.key,
      name: input.name,
      scopeType: 'organization',
      permissionIds: input.permissionIds,
    });

    await this.auditLog.record({
      action: 'role.created',
      entityType: 'role',
      entityId: role.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return role;
  }

  async updatePermissions(
    roleId: string,
    permissionIds: string[],
    expectedVersion: number,
    organizationId?: string,
    actorUserId?: string,
  ): Promise<RoleWithPermissions> {
    const existing = await this.get(roleId, organizationId);
    if (existing.isSystem) {
      throw AppException.forbidden('System role definitions cannot be edited.');
    }

    await this.assertPermissionsExist(permissionIds);

    try {
      const updated = await this.rolesRepository.updatePermissions(
        roleId,
        permissionIds,
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'role.updated',
        entityType: 'role',
        entityId: roleId,
        outcome: 'success',
        organizationId,
        actorUserId,
      });
      return updated;
    } catch (error) {
      if (error instanceof RoleVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Role has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  async retire(roleId: string, organizationId?: string, actorUserId?: string): Promise<void> {
    const role = await this.get(roleId, organizationId);
    if (role.isSystem) {
      throw AppException.forbidden('System roles cannot be retired.');
    }

    const activeAssignments = await this.rolesRepository.countActiveAssignments(roleId);
    if (activeAssignments > 0) {
      throw AppException.conflict(
        'ROLE_IN_USE',
        'This role has active assignments and cannot be removed.',
      );
    }

    await this.rolesRepository.softDelete(roleId);
    await this.auditLog.record({
      action: 'role.retired',
      entityType: 'role',
      entityId: roleId,
      outcome: 'success',
      organizationId,
      actorUserId,
    });
  }

  /** Composes existing `role.read`+`role.create` permission checks (no new
   * key) — copies a source role's current permission grants onto a new
   * role, via the existing `create()` path. */
  async clone(
    sourceRoleId: string,
    input: { name: string; key: string },
    scope: TenantScope,
    actorUserId?: string,
  ): Promise<RoleWithPermissions> {
    const source = await this.get(sourceRoleId, scope.organizationId);
    const role = await this.create(
      scope,
      {
        name: input.name,
        key: input.key,
        permissionIds: source.rolePermissions.map((rp) => rp.permission.id),
      },
      actorUserId,
    );

    await this.auditLog.record({
      action: 'role.cloned',
      entityType: 'role',
      entityId: role.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { sourceRoleId },
    });
    return role;
  }

  /** Every role (system + this organization's custom roles) × every
   * permission, in one response — the Role & Permission Management
   * permission-matrix view. */
  async getPermissionMatrix(scope: TenantScope): Promise<{
    permissions: { id: string; key: string; resource: string; action: string }[];
    roles: {
      id: string;
      key: string;
      name: string;
      isSystem: boolean;
      grantedPermissionIds: string[];
    }[];
  }> {
    const [permissions, roles] = await Promise.all([
      this.permissionsRepository.list(),
      this.rolesRepository.listForOrganization(scope.organizationId),
    ]);

    return {
      permissions: permissions.map((p) => ({
        id: p.id,
        key: p.key,
        resource: p.resource,
        action: p.action,
      })),
      roles: roles.map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        isSystem: role.isSystem,
        grantedPermissionIds: role.rolePermissions.map((rp) => rp.permission.id),
      })),
    };
  }

  private async assertPermissionsExist(permissionIds: string[]): Promise<void> {
    if (permissionIds.length === 0) return;
    const found = await this.permissionsRepository.findByIds(permissionIds);
    if (found.length !== new Set(permissionIds).size) {
      throw AppException.validation([
        {
          field: 'permissionIds',
          code: 'UNKNOWN_PERMISSION',
          message: 'One or more permission ids are unknown.',
        },
      ]);
    }
  }
}
