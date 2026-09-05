import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateCourseRequest, ReorderItem, UpdateCourseRequest } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  archiveCourse,
  createCourse,
  publishCourse,
  reorderCourses,
  restoreCourse,
  updateCourse,
} from '../api/courses-api';

export function useCreateCourse(trackId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCourseRequest) => createCourse(trackId, body, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses', 'list', trackId] }),
  });
}

export function useUpdateCourse(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateCourseRequest; version: number }) =>
      updateCourse(id, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['courses', 'detail', id, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['courses', 'list'] });
    },
  });
}

export function useCourseLifecycleActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['courses', 'detail', id, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['courses', 'list'] });
  };

  const publish = useMutation({
    mutationFn: (version: number) => publishCourse(id, version, activeOrganizationId),
    onSuccess,
  });
  const archive = useMutation({
    mutationFn: (version: number) => archiveCourse(id, version, activeOrganizationId),
    onSuccess,
  });
  const restore = useMutation({
    mutationFn: (version: number) => restoreCourse(id, version, activeOrganizationId),
    onSuccess,
  });

  return { publish, archive, restore };
}

export function useReorderCourses(trackId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) => reorderCourses(trackId, items, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses', 'list', trackId] }),
  });
}
