import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePracticalTaskRequest,
  ReorderItem,
  UpdatePracticalTaskRequest,
} from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  archivePracticalTask,
  createPracticalTask,
  publishPracticalTask,
  reorderPracticalTasks,
  restorePracticalTask,
  updatePracticalTask,
} from '../api/practical-tasks-api';

export function useCreatePracticalTask(moduleId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePracticalTaskRequest) =>
      createPracticalTask(moduleId, body, activeOrganizationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['practical-tasks', 'list', moduleId] }),
  });
}

export function useUpdatePracticalTask(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdatePracticalTaskRequest; version: number }) =>
      updatePracticalTask(id, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['practical-tasks', 'detail', id, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['practical-tasks', 'list'] });
    },
  });
}

export function usePracticalTaskLifecycleActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['practical-tasks', 'detail', id, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['practical-tasks', 'list'] });
  };

  const publish = useMutation({
    mutationFn: (version: number) => publishPracticalTask(id, version, activeOrganizationId),
    onSuccess,
  });
  const archive = useMutation({
    mutationFn: (version: number) => archivePracticalTask(id, version, activeOrganizationId),
    onSuccess,
  });
  const restore = useMutation({
    mutationFn: (version: number) => restorePracticalTask(id, version, activeOrganizationId),
    onSuccess,
  });

  return { publish, archive, restore };
}

export function useReorderPracticalTasks(moduleId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) =>
      reorderPracticalTasks(moduleId, items, activeOrganizationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['practical-tasks', 'list', moduleId] }),
  });
}
