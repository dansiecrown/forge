import { useCallback, useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Fellowship } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getFellowship, listFellowships } from '../api/fellowships-api';

/** `academyId` scopes the list to one academy's own fellowships — used by
 * the Academy detail page's contextual "Fellowships" section so it never
 * shows every fellowship in the organization. */
export function useFellowshipsList(q: string, status: string, academyId?: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Fellowship[]>([]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [q, status, academyId, activeOrganizationId]);

  const query = useQuery({
    queryKey: ['fellowships', 'list', activeOrganizationId, academyId, q, status, cursor],
    queryFn: () =>
      listFellowships(
        { academyId, q: q || undefined, status: status || undefined, cursor },
        activeOrganizationId,
      ),
    enabled: Boolean(activeOrganizationId),
  });

  const rows =
    cursor === undefined ? (query.data?.items ?? []) : [...items, ...(query.data?.items ?? [])];

  const loadMore = useCallback(() => {
    if (query.data?.page.nextCursor) {
      setItems(rows);
      setCursor(query.data.page.nextCursor);
    }
  }, [query.data, rows]);

  return {
    rows,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    hasMore: query.data?.page.hasMore ?? false,
    loadMore,
  };
}

export function useFellowship(id: string | undefined): UseQueryResult<Fellowship> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['fellowships', 'detail', id, activeOrganizationId],
    queryFn: () => getFellowship(id as string, activeOrganizationId),
    enabled: Boolean(id) && Boolean(activeOrganizationId),
  });
}

/** All published/draft fellowships in the active organization, for the
 * Cohort create form's fellowship picker. */
export function useFellowshipOptions() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['fellowships', 'options', activeOrganizationId],
    queryFn: () => listFellowships({ limit: 100 }, activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
}
