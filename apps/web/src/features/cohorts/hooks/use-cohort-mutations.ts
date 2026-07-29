import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCohortRequest,
  CreateEnrollmentRequest,
  UpdateCohortRequest,
  UpdateEnrollmentRequest,
} from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  activateCohort,
  assignCohortMentor,
  completeCohort,
  createCohort,
  createEnrollment,
  pauseCohort,
  syncCohortCurriculum,
  unassignCohortMentor,
  updateCohort,
  updateEnrollment,
} from '../api/cohorts-api';

export function useCreateCohort() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCohortRequest) => createCohort(body, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cohorts', 'list'] }),
  });
}

export function useUpdateCohort(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdateCohortRequest; version: number }) =>
      updateCohort(id, body, version, activeOrganizationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['cohorts', 'detail', id, activeOrganizationId], updated);
      void queryClient.invalidateQueries({ queryKey: ['cohorts', 'list'] });
    },
  });
}

export function useCohortLifecycleActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = (updated: unknown) => {
    queryClient.setQueryData(['cohorts', 'detail', id, activeOrganizationId], updated);
    void queryClient.invalidateQueries({ queryKey: ['cohorts', 'list'] });
  };

  const activate = useMutation({
    mutationFn: (version: number) => activateCohort(id, version, activeOrganizationId),
    onSuccess,
  });
  const pause = useMutation({
    mutationFn: (version: number) => pauseCohort(id, version, activeOrganizationId),
    onSuccess,
  });
  const complete = useMutation({
    mutationFn: (version: number) => completeCohort(id, version, activeOrganizationId),
    onSuccess,
  });
  const syncCurriculum = useMutation({
    mutationFn: (version: number) => syncCohortCurriculum(id, version, activeOrganizationId),
    onSuccess,
  });

  return { activate, pause, complete, syncCurriculum };
}

export function useMentorAssignment(cohortId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['cohorts', 'mentors', cohortId, activeOrganizationId],
    });

  const assign = useMutation({
    mutationFn: (membershipId: string) =>
      assignCohortMentor(cohortId, membershipId, activeOrganizationId),
    onSuccess: invalidate,
  });
  const unassign = useMutation({
    mutationFn: (membershipId: string) =>
      unassignCohortMentor(cohortId, membershipId, activeOrganizationId),
    onSuccess: invalidate,
  });

  return { assign, unassign };
}

export function useEnrollmentActions(cohortId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['cohorts', 'enrollments', cohortId, activeOrganizationId],
    });

  const enroll = useMutation({
    mutationFn: (body: CreateEnrollmentRequest) =>
      createEnrollment(cohortId, body, activeOrganizationId),
    onSuccess: invalidate,
  });
  const updateStatus = useMutation({
    mutationFn: ({
      id,
      body,
      version,
    }: {
      id: string;
      body: UpdateEnrollmentRequest;
      version: number;
    }) => updateEnrollment(id, body, version, activeOrganizationId),
    onSuccess: invalidate,
  });

  return { enroll, updateStatus };
}
