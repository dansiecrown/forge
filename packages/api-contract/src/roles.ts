// Hand-authored request/response contracts for Role & Permission Management.
// See organizations.ts for the pattern this follows.

export interface Permission {
  id: string;
  key: string;
  resource: string;
  action: string;
  scopeCapability: 'organization' | 'academy' | 'platform';
  description: string | null;
}

export interface Role {
  id: string;
  organizationId: string | null;
  key: string;
  name: string;
  scopeType: 'platform' | 'organization' | 'academy';
  isSystem: boolean;
  status: string;
  version: number;
  description: string | null;
  rolePermissions: { permission: Permission }[];
}

export interface CreateRoleRequest {
  name: string;
  key: string;
  permissionIds: string[];
}

export interface UpdateRolePermissionsRequest {
  permissionIds: string[];
}

export interface CloneRoleRequest {
  name: string;
  key: string;
}

export interface PermissionMatrix {
  permissions: { id: string; key: string; resource: string; action: string }[];
  roles: {
    id: string;
    key: string;
    name: string;
    isSystem: boolean;
    grantedPermissionIds: string[];
  }[];
}
