import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateWeeklyModuleRequest, UpdateWeeklyModuleRequest } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  archiveWeeklyModule,
  createWeeklyModule,
  publishWeeklyModule,
  restoreWeeklyModule,
  updateWeeklyModule,
} from '../api/weekly-modules-api';

export function useCreateWeeklyModule(courseId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWeeklyModuleRequest) =>
      createWeeklyModule(courseId, body, activeOrganizationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['weekly-modules', 'list', courseId] }),
  });
}

export function useUpdateWeeklyModule(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateWeeklyModuleRequest; version: number }) =>
      updateWeeklyModule(id, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['weekly-modules', 'detail', id, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['weekly-modules', 'list'] });
    },
  });
}

export function useWeeklyModuleLifecycleActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['weekly-modules', 'detail', id, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['weekly-modules', 'list'] });
  };

  const publish = useMutation({
    mutationFn: (version: number) => publishWeeklyModule(id, version, activeOrganizationId),
    onSuccess,
  });
  const archive = useMutation({
    mutationFn: (version: number) => archiveWeeklyModule(id, version, activeOrganizationId),
    onSuccess,
  });
  const restore = useMutation({
    mutationFn: (version: number) => restoreWeeklyModule(id, version, activeOrganizationId),
    onSuccess,
  });

  return { publish, archive, restore };
}
