import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateFellowshipRequest, UpdateFellowshipRequest } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  createFellowship,
  publishFellowship,
  retireFellowship,
  updateFellowship,
} from '../api/fellowships-api';

export function useCreateFellowship() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFellowshipRequest) => createFellowship(body, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fellowships', 'list'] }),
  });
}

export function useUpdateFellowship(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateFellowshipRequest; version: number }) =>
      updateFellowship(id, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['fellowships', 'detail', id, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['fellowships', 'list'] });
    },
  });
}

export function useFellowshipLifecycleActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['fellowships', 'detail', id, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['fellowships', 'list'] });
  };

  const publish = useMutation({
    mutationFn: (version: number) => publishFellowship(id, version, activeOrganizationId),
    onSuccess,
  });
  const retire = useMutation({
    mutationFn: (version: number) => retireFellowship(id, version, activeOrganizationId),
    onSuccess,
  });

  return { publish, retire };
}
