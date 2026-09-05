import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateLearningResourceRequest,
  ReorderItem,
  UpdateLearningResourceRequest,
} from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  archiveLearningResource,
  createLearningResource,
  publishLearningResource,
  reorderLearningResources,
  restoreLearningResource,
  updateLearningResource,
} from '../api/learning-resources-api';

export function useCreateLearningResource(moduleId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLearningResourceRequest) =>
      createLearningResource(moduleId, body, activeOrganizationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['learning-resources', 'list', moduleId] }),
  });
}

export function useUpdateLearningResource(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateLearningResourceRequest; version: number }) =>
      updateLearningResource(id, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['learning-resources', 'detail', id, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['learning-resources', 'list'] });
    },
  });
}

export function useLearningResourceLifecycleActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['learning-resources', 'detail', id, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['learning-resources', 'list'] });
  };

  const publish = useMutation({
    mutationFn: (version: number) => publishLearningResource(id, version, activeOrganizationId),
    onSuccess,
  });
  const archive = useMutation({
    mutationFn: (version: number) => archiveLearningResource(id, version, activeOrganizationId),
    onSuccess,
  });
  const restore = useMutation({
    mutationFn: (version: number) => restoreLearningResource(id, version, activeOrganizationId),
    onSuccess,
  });

  return { publish, archive, restore };
}

export function useReorderLearningResources(moduleId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) =>
      reorderLearningResources(moduleId, items, activeOrganizationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['learning-resources', 'list', moduleId] }),
  });
}
