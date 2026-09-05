import { useCallback, useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Cohort, CohortMentorAssignment, Enrollment } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getCohort, listCohortMentors, listCohorts, listEnrollments } from '../api/cohorts-api';

export function useCohortsList(q: string, status: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Cohort[]>([]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [q, status, activeOrganizationId]);

  const query = useQuery({
    queryKey: ['cohorts', 'list', activeOrganizationId, q, status, cursor],
    queryFn: () =>
      listCohorts({ q: q || undefined, status: status || undefined, cursor }, activeOrganizationId),
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

export function useCohort(id: string | undefined): UseQueryResult<Cohort> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['cohorts', 'detail', id, activeOrganizationId],
    queryFn: () => getCohort(id as string, activeOrganizationId),
    enabled: Boolean(id) && Boolean(activeOrganizationId),
  });
}

export function useCohortMentors(
  cohortId: string | undefined,
): UseQueryResult<CohortMentorAssignment[]> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['cohorts', 'mentors', cohortId, activeOrganizationId],
    queryFn: () => listCohortMentors(cohortId as string, activeOrganizationId),
    enabled: Boolean(cohortId) && Boolean(activeOrganizationId),
  });
}

export function useCohortEnrollments(cohortId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['cohorts', 'enrollments', cohortId, activeOrganizationId],
    queryFn: () => listEnrollments(cohortId as string, activeOrganizationId),
    enabled: Boolean(cohortId) && Boolean(activeOrganizationId),
  });
  return {
    rows: query.data?.items ?? ([] as Enrollment[]),
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
