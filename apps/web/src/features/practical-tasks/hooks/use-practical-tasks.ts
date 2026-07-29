import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { PracticalTask } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getPracticalTask, listPracticalTasks } from '../api/practical-tasks-api';

export function usePracticalTasksList(moduleId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['practical-tasks', 'list', moduleId, activeOrganizationId],
    queryFn: () => listPracticalTasks(moduleId as string, { limit: 100 }, activeOrganizationId),
    enabled: Boolean(moduleId) && Boolean(activeOrganizationId),
  });
  return {
    rows: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function usePracticalTask(id: string | undefined): UseQueryResult<PracticalTask> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['practical-tasks', 'detail', id, activeOrganizationId],
    queryFn: () => getPracticalTask(id as string, activeOrganizationId),
    enabled: Boolean(id) && Boolean(activeOrganizationId),
  });
}
