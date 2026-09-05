import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateOrganizationRequest, UpdateOrganizationRequest } from '@forge/api-contract';
import {
  archiveOrganization,
  createOrganization,
  restoreOrganization,
  suspendOrganization,
  updateOrganization,
} from '../api/organizations-api';

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationRequest) => createOrganization(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] }),
  });
}

export function useUpdateOrganization(orgId: string, organizationId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateOrganizationRequest; version: number }) =>
      updateOrganization(orgId, body, version, organizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['organizations', 'detail', orgId], updated);
      void queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] });
    },
  });
}

export function useOrganizationLifecycleActions(orgId: string) {
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['organizations', 'detail', orgId], updated);
    void queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] });
  };

  const suspend = useMutation({
    mutationFn: (reason: string) => suspendOrganization(orgId, reason),
    onSuccess,
  });
  const archive = useMutation({
    mutationFn: (reason: string) => archiveOrganization(orgId, reason),
    onSuccess,
  });
  const restore = useMutation({
    mutationFn: () => restoreOrganization(orgId),
    onSuccess,
  });

  return { suspend, archive, restore };
}
