import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateLearningTrackRequest,
  ReorderItem,
  UpdateLearningTrackRequest,
} from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  archiveLearningTrack,
  createLearningTrack,
  publishLearningTrack,
  reorderLearningTracks,
  restoreLearningTrack,
  updateLearningTrack,
} from '../api/learning-tracks-api';

export function useCreateLearningTrack(fellowshipId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLearningTrackRequest) =>
      createLearningTrack(fellowshipId, body, activeOrganizationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['learning-tracks', 'list', fellowshipId] }),
  });
}

export function useUpdateLearningTrack(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateLearningTrackRequest; version: number }) =>
      updateLearningTrack(id, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['learning-tracks', 'detail', id, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['learning-tracks', 'list'] });
    },
  });
}

export function useLearningTrackLifecycleActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['learning-tracks', 'detail', id, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['learning-tracks', 'list'] });
  };

  const publish = useMutation({
    mutationFn: (version: number) => publishLearningTrack(id, version, activeOrganizationId),
    onSuccess,
  });
  const archive = useMutation({
    mutationFn: (version: number) => archiveLearningTrack(id, version, activeOrganizationId),
    onSuccess,
  });
  const restore = useMutation({
    mutationFn: (version: number) => restoreLearningTrack(id, version, activeOrganizationId),
    onSuccess,
  });

  return { publish, archive, restore };
}

export function useReorderLearningTracks(fellowshipId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) =>
      reorderLearningTracks(fellowshipId, items, activeOrganizationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['learning-tracks', 'list', fellowshipId] }),
  });
}
