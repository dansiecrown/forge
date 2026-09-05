import type {
  CloneRoleRequest,
  CreateRoleRequest,
  PermissionMatrix,
  Role,
  UpdateRolePermissionsRequest,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function listRoles(organizationId?: string): Promise<Role[]> {
  return apiRequest<Role[]>('/roles', { organizationId });
}

export function getRole(roleId: string, organizationId?: string): Promise<Role> {
  return apiRequest<Role>(`/roles/${roleId}`, { organizationId });
}

export function createRole(body: CreateRoleRequest, organizationId?: string): Promise<Role> {
  return apiRequest<Role>('/roles', { method: 'POST', body, organizationId });
}

export function updateRolePermissions(
  roleId: string,
  body: UpdateRolePermissionsRequest,
  version: number,
  organizationId?: string,
): Promise<Role> {
  return apiRequest<Role>(`/roles/${roleId}`, {
    method: 'PATCH',
    body,
    ifMatch: version,
    organizationId,
  });
}

export function cloneRole(
  roleId: string,
  body: CloneRoleRequest,
  organizationId?: string,
): Promise<Role> {
  return apiRequest<Role>(`/roles/${roleId}/actions/clone`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function retireRole(roleId: string, organizationId?: string): Promise<void> {
  return apiRequest(`/roles/${roleId}`, { method: 'DELETE', organizationId });
}

export function getPermissionMatrix(organizationId?: string): Promise<PermissionMatrix> {
  return apiRequest<PermissionMatrix>('/roles/permission-matrix', { organizationId });
}
