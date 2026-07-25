import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateAcademyRequest, UpdateAcademyRequest } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { archiveAcademy, createAcademy, restoreAcademy, updateAcademy } from '../api/academies-api';

export function useCreateAcademy() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAcademyRequest) => createAcademy(body, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academies', 'list'] }),
  });
}

export function useUpdateAcademy(academyId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateAcademyRequest; version: number }) =>
      updateAcademy(academyId, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['academies', 'detail', academyId, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['academies', 'list'] });
    },
  });
}

export function useAcademyLifecycleActions(academyId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['academies', 'detail', academyId, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['academies', 'list'] });
  };

  const archive = useMutation({
    mutationFn: (reason: string) => archiveAcademy(academyId, reason, activeOrganizationId),
    onSuccess,
  });
  const restore = useMutation({
    mutationFn: () => restoreAcademy(academyId, activeOrganizationId),
    onSuccess,
  });

  return { archive, restore };
}
