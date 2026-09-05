import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCohortRequest,
  UpdateCohortRequest,
  UpdateEnrollmentRequest,
} from '@forge/api-contract';
import { ApiError } from '@/api/client';
import { useActiveOrganization } from '@/contexts/organization-context';
import type { AdminUser } from '@/features/admin-users/api/admin-users-api';
import { getUserMemberships } from '@/features/organizations/api/organizations-api';
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
    // Cohort mentor assignment is keyed by membership, not user — the
    // person picked by email/name has to be resolved to their membership
    // id in the active organization first (docs/api-specification.md
    // `POST /cohorts/:id/mentors` expects `membershipId`).
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
      return assignCohortMentor(cohortId, membership.id, activeOrganizationId);
    },
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
    mutationFn: (student: AdminUser) =>
      createEnrollment(cohortId, { studentUserId: student.id }, activeOrganizationId),
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
