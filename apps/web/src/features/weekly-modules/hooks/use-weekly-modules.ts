import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { WeeklyModule } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getWeeklyModule, listWeeklyModules } from '../api/weekly-modules-api';

/** All weekly modules in a course, embedded in the course's detail page. */
export function useWeeklyModulesList(courseId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['weekly-modules', 'list', courseId, activeOrganizationId],
    queryFn: () => listWeeklyModules(courseId as string, { limit: 100 }, activeOrganizationId),
    enabled: Boolean(courseId) && Boolean(activeOrganizationId),
  });
  return {
    rows: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useWeeklyModule(id: string | undefined): UseQueryResult<WeeklyModule> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['weekly-modules', 'detail', id, activeOrganizationId],
    queryFn: () => getWeeklyModule(id as string, activeOrganizationId),
    enabled: Boolean(id) && Boolean(activeOrganizationId),
  });
}
