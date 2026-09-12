import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BulkCohortApplicationItem,
  CohortApplication,
  ListCohortApplicationsParams,
} from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  approveCohortApplication,
  bulkApproveCohortApplications,
  bulkRejectCohortApplications,
  getCohortApplication,
  listCohortApplications,
  rejectCohortApplication,
} from '../api/admin-cohort-applications-api';

export interface CohortApplicationsFilter {
  status: string;
  fellowshipId: string;
  q: string;
}

export function useCohortApplicationsList(filter: CohortApplicationsFilter) {
  const { activeOrganizationId } = useActiveOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<CohortApplication[]>([]);
  const { status, fellowshipId, q } = filter;

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [status, fellowshipId, q]);

  const params: ListCohortApplicationsParams = {
    status: status || undefined,
    fellowshipId: fellowshipId || undefined,
    q: q || undefined,
    cursor,
  };

  const query = useQuery({
    queryKey: [
      'cohort-applications',
      'admin-list',
      status,
      fellowshipId,
      q,
      cursor,
      activeOrganizationId,
    ],
    queryFn: () => listCohortApplications(params, activeOrganizationId),
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

export function useBulkCohortApplicationActions() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['cohort-applications', 'admin-list'] });

  const bulkApprove = useMutation({
    mutationFn: (items: BulkCohortApplicationItem[]) =>
      bulkApproveCohortApplications({ items }, activeOrganizationId),
    onSuccess: invalidate,
  });
  const bulkReject = useMutation({
    mutationFn: ({ items, reason }: { items: BulkCohortApplicationItem[]; reason?: string }) =>
      bulkRejectCohortApplications({ items, reason }, activeOrganizationId),
    onSuccess: invalidate,
  });

  return { bulkApprove, bulkReject };
}
