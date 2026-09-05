import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CohortApplication } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  approveCohortApplication,
  getCohortApplication,
  listCohortApplications,
  rejectCohortApplication,
} from '../api/admin-cohort-applications-api';

export function useCohortApplicationsList(status: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<CohortApplication[]>([]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [status]);

  const query = useQuery({
    queryKey: ['cohort-applications', 'admin-list', status, cursor, activeOrganizationId],
    queryFn: () =>
      listCohortApplications({ status: status || undefined, cursor }, activeOrganizationId),
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

export function useCohortApplication(id: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['cohort-applications', 'detail', id, activeOrganizationId],
    queryFn: () => getCohortApplication(id as string, activeOrganizationId),
    enabled: Boolean(id && activeOrganizationId),
  });
}

export function useCohortApplicationActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cohort-applications', 'detail', id] });
    void queryClient.invalidateQueries({ queryKey: ['cohort-applications', 'admin-list'] });
  };

  const approve = useMutation({
    mutationFn: (version: number) =>
      approveCohortApplication(id, { version }, activeOrganizationId),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: ({ version, reason }: { version: number; reason?: string }) =>
      rejectCohortApplication(id, { version, reason }, activeOrganizationId),
    onSuccess: invalidate,
  });

  return { approve, reject };
}
