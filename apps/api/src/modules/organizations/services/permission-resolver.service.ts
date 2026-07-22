import { Injectable } from '@nestjs/common';
import { MembershipsRepository } from '../repositories/memberships.repository';

export const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN';

export interface ResolvedAuthorization {
  organizationId: string;
  permissionKeys: Set<string>;
  isSuperAdmin: boolean;
}

/** Resolves what a user may do within an organization: tenant scope (1) and
 * role permissions (2) from docs/system-architecture.md §7. Resource-policy
 * (3) and field-minimization (4) stay with each module's own services and
 * serializers. */
@Injectable()
export class PermissionResolverService {
  constructor(private readonly membershipsRepository: MembershipsRepository) {}

  async resolve(userId: string, organizationId: string): Promise<ResolvedAuthorization> {
    const isSuperAdmin = await this.hasPlatformRole(userId, SUPER_ADMIN_ROLE_KEY);
    const permissionKeys = isSuperAdmin
      ? new Set<string>()
      : await this.membershipsRepository.findPermissionKeys({ organizationId }, userId);

    return { organizationId, permissionKeys, isSuperAdmin };
  }

  async hasPermission(
    userId: string,
    organizationId: string,
    permissionKey: string,
  ): Promise<boolean> {
    const authorization = await this.resolve(userId, organizationId);
    return authorization.isSuperAdmin || authorization.permissionKeys.has(permissionKey);
  }

  async hasPlatformRole(userId: string, roleKey: string): Promise<boolean> {
    const grants = await this.membershipsRepository.findPlatformRoleGrants(userId, roleKey);
    return grants.length > 0;
  }
}
