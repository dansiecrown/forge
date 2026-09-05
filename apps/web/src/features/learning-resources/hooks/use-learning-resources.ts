import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { LearningResource } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getLearningResource, listLearningResources } from '../api/learning-resources-api';

export function useLearningResourcesList(moduleId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['learning-resources', 'list', moduleId, activeOrganizationId],
    queryFn: () => listLearningResources(moduleId as string, { limit: 100 }, activeOrganizationId),
    enabled: Boolean(moduleId) && Boolean(activeOrganizationId),
  });
  return {
    rows: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useLearningResource(id: string | undefined): UseQueryResult<LearningResource> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['learning-resources', 'detail', id, activeOrganizationId],
    queryFn: () => getLearningResource(id as string, activeOrganizationId),
    enabled: Boolean(id) && Boolean(activeOrganizationId),
  });
}
