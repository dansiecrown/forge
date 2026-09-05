import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateLessonRequest, ReorderItem, UpdateLessonRequest } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  archiveLesson,
  createLesson,
  publishLesson,
  reorderLessons,
  restoreLesson,
  updateLesson,
} from '../api/lessons-api';

export function useCreateLesson(moduleId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLessonRequest) => createLesson(moduleId, body, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lessons', 'list', moduleId] }),
  });
}

export function useUpdateLesson(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateLessonRequest; version: number }) =>
      updateLesson(id, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['lessons', 'detail', id, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['lessons', 'list'] });
    },
  });
}

export function useLessonLifecycleActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['lessons', 'detail', id, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['lessons', 'list'] });
  };

  const publish = useMutation({
    mutationFn: (version: number) => publishLesson(id, version, activeOrganizationId),
    onSuccess,
  });
  const archive = useMutation({
    mutationFn: (version: number) => archiveLesson(id, version, activeOrganizationId),
    onSuccess,
  });
  const restore = useMutation({
    mutationFn: (version: number) => restoreLesson(id, version, activeOrganizationId),
    onSuccess,
  });

  return { publish, archive, restore };
}

export function useReorderLessons(moduleId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) => reorderLessons(moduleId, items, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lessons', 'list', moduleId] }),
  });
}
