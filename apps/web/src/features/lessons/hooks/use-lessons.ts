import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Lesson } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getLesson, listLessons } from '../api/lessons-api';

export function useLessonsList(moduleId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['lessons', 'list', moduleId, activeOrganizationId],
    queryFn: () => listLessons(moduleId as string, { limit: 100 }, activeOrganizationId),
    enabled: Boolean(moduleId) && Boolean(activeOrganizationId),
  });
  return {
    rows: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useLesson(id: string | undefined): UseQueryResult<Lesson> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['lessons', 'detail', id, activeOrganizationId],
    queryFn: () => getLesson(id as string, activeOrganizationId),
    enabled: Boolean(id) && Boolean(activeOrganizationId),
  });
}
