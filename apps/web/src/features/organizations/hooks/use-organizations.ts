import { useCallback, useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Organization } from '@forge/api-contract';
import { getOrganization, listOrganizations } from '../api/organizations-api';

export function useOrganizationsList(q: string, status: string) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Organization[]>([]);

  // A new search/filter starts a fresh cursor chain rather than appending to
  // whatever page the previous search had reached.
  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [q, status]);

  const query = useQuery({
    queryKey: ['organizations', 'list', q, status, cursor],
    queryFn: () => listOrganizations({ q: q || undefined, status: status || undefined, cursor }),
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

export function useOrganization(
  orgId: string | undefined,
  organizationId?: string,
): UseQueryResult<Organization> {
  return useQuery({
    queryKey: ['organizations', 'detail', orgId],
    queryFn: () => getOrganization(orgId as string, organizationId),
    enabled: Boolean(orgId),
  });
}
