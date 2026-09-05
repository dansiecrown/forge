import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateLearningTrackRequest,
  ReorderItem,
  UpdateLearningTrackRequest,
} from '@forge/api-contract';
import { ApiError } from '@/api/client';
import { useActiveOrganization } from '@/contexts/organization-context';
import type { AdminUser } from '@/features/admin-users/api/admin-users-api';
import { getUserMemberships } from '@/features/organizations/api/organizations-api';
import {
  archiveLearningTrack,
  assignTrackMentor,
  createLearningTrack,
  publishLearningTrack,
  reorderLearningTracks,
  restoreLearningTrack,
  unassignTrackMentor,
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

export function useTrackMentorAssignment(trackId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['learning-tracks', 'mentors', trackId, activeOrganizationId],
    });

  const assign = useMutation({
    // Fellowship-wide track mentor assignment is keyed by membership, not
    // user — same resolution as the Cohort mentor assignment flow
    // (docs/api-specification.md `POST /learning-tracks/:id/mentors`).
    mutationFn: async (person: AdminUser) => {
      const memberships = await getUserMemberships(person.id, activeOrganizationId);
      const membership = memberships.find((m) => m.organizationId === activeOrganizationId);
      if (!membership) {
        throw new ApiError(
          'NOT_A_MEMBER',
          `${person.displayName} has no membership in this organization.`,
          404,
        );
      }
      return assignTrackMentor(trackId, { membershipId: membership.id }, activeOrganizationId);
    },
    onSuccess: invalidate,
  });
  const unassign = useMutation({
    mutationFn: (membershipId: string) =>
      unassignTrackMentor(trackId, membershipId, activeOrganizationId),
    onSuccess: invalidate,
  });

  return { assign, unassign };
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
