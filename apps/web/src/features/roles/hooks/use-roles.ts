import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CloneRoleRequest,
  CreateRoleRequest,
  UpdateRolePermissionsRequest,
} from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  cloneRole,
  createRole,
  getPermissionMatrix,
  getRole,
  listRoles,
  retireRole,
  updateRolePermissions,
} from '../api/roles-api';

export function useRolesList() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['roles', 'list', activeOrganizationId],
    queryFn: () => listRoles(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
}

export function useRole(roleId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['roles', 'detail', roleId],
    queryFn: () => getRole(roleId as string, activeOrganizationId),
    enabled: Boolean(roleId),
  });
}

export function usePermissionMatrix() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['roles', 'permission-matrix', activeOrganizationId],
    queryFn: () => getPermissionMatrix(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
}

export function useCreateRole() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoleRequest) => createRole(body, activeOrganizationId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['roles', 'list'] }),
  });
}

export function useCloneRole() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, body }: { roleId: string; body: CloneRoleRequest }) =>
      cloneRole(roleId, body, activeOrganizationId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['roles', 'list'] }),
  });
}

export function useUpdateRolePermissions(roleId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateRolePermissionsRequest; version: number }) =>
      updateRolePermissions(roleId, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['roles', 'detail', roleId], updated);
      void queryClient.invalidateQueries({ queryKey: ['roles', 'list'] });
    },
  });
}

export function useRetireRole() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => retireRole(roleId, activeOrganizationId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['roles', 'list'] }),
  });
}
