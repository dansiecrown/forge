import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmitStudentApplicationRequest } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  listMyApplications,
  submitStudentApplication,
  withdrawApplication,
} from '../api/cohort-applications-api';

export function useMyApplications() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['cohort-applications', 'mine', activeOrganizationId],
    queryFn: () => listMyApplications(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
}

export function useSubmitStudentApplication() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitStudentApplicationRequest) =>
      submitStudentApplication(body, activeOrganizationId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['cohort-applications', 'mine'] }),
  });
}

export function useWithdrawApplication() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      withdrawApplication(id, { version }, activeOrganizationId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['cohort-applications', 'mine'] }),
  });
}
