import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Course } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getCourse, listCourses } from '../api/courses-api';

/** All courses in a learning track, embedded in the track's detail page —
 * first page only, matching the established child-collection pattern
 * (see CohortDetailPage's mentors/enrollments). */
export function useCoursesList(trackId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['courses', 'list', trackId, activeOrganizationId],
    queryFn: () => listCourses(trackId as string, { limit: 100 }, activeOrganizationId),
    enabled: Boolean(trackId) && Boolean(activeOrganizationId),
  });
  return {
    rows: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useCourse(id: string | undefined): UseQueryResult<Course> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['courses', 'detail', id, activeOrganizationId],
    queryFn: () => getCourse(id as string, activeOrganizationId),
    enabled: Boolean(id) && Boolean(activeOrganizationId),
  });
}
