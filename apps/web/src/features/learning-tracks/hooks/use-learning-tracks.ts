import { useCallback, useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { LearningTrack } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getLearningTrack, listLearningTracks } from '../api/learning-tracks-api';

export function useLearningTracksList(fellowshipId: string | undefined, q: string, status: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<LearningTrack[]>([]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [fellowshipId, q, status, activeOrganizationId]);

  const query = useQuery({
    queryKey: ['learning-tracks', 'list', fellowshipId, activeOrganizationId, q, status, cursor],
    queryFn: () =>
      listLearningTracks(
        fellowshipId as string,
        { q: q || undefined, status: status || undefined, cursor },
        activeOrganizationId,
      ),
    enabled: Boolean(fellowshipId) && Boolean(activeOrganizationId),
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

/** All tracks in a fellowship, unpaginated — for the track list embedded in
 * the WeeklyModuleDetailPage-style parent pages and for reorder controls. */
export function useLearningTracksOptions(fellowshipId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['learning-tracks', 'options', fellowshipId, activeOrganizationId],
    queryFn: () => listLearningTracks(fellowshipId as string, { limit: 100 }, activeOrganizationId),
    enabled: Boolean(fellowshipId) && Boolean(activeOrganizationId),
  });
}

export function useLearningTrack(id: string | undefined): UseQueryResult<LearningTrack> {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['learning-tracks', 'detail', id, activeOrganizationId],
    queryFn: () => getLearningTrack(id as string, activeOrganizationId),
    enabled: Boolean(id) && Boolean(activeOrganizationId),
  });
}
