import { useCallback, useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Academy } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getAcademy, listAcademies } from '../api/academies-api';

export function useAcademiesList(q: string, status: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Academy[]>([]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [q, status, activeOrganizationId]);

  const query = useQuery({
    queryKey: ['academies', 'list', activeOrganizationId, q, status, cursor],
    queryFn: () =>
      listAcademies(
        { q: q || undefined, status: status || undefined, cursor },
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

export function useAcademy(academyId: string | undefined): UseQueryResult<Academy> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['academies', 'detail', academyId, activeOrganizationId],
    queryFn: () => getAcademy(academyId as string, activeOrganizationId),
    enabled: Boolean(academyId) && Boolean(activeOrganizationId),
  });
}

/** All active academies in the active organization, for a `<select>` picker
 * (Fellowship create form) — capped at a single page since no org is
 * expected to have hundreds of academies. */
export function useAcademyOptions() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['academies', 'options', activeOrganizationId],
    queryFn: () => listAcademies({ limit: 100 }, activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
}
