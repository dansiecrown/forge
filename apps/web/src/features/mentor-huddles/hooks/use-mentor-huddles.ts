import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  RecordHuddleAttendanceRequest,
  UpsertHuddleSessionRequest,
} from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  getHuddleSession,
  listSessionAttendance,
  recordAttendance,
  upsertHuddleSession,
} from '../api/mentor-huddles-api';

export function useHuddleSession(cohortId: string | undefined, weekNumber: number) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['mentors', 'huddles', cohortId, weekNumber, activeOrganizationId],
    queryFn: () => getHuddleSession(cohortId as string, weekNumber, activeOrganizationId),
    enabled: Boolean(cohortId) && Boolean(activeOrganizationId),
  });
}

export function useUpsertHuddleSession(cohortId: string, weekNumber: number) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertHuddleSessionRequest) =>
      upsertHuddleSession(cohortId, weekNumber, body, activeOrganizationId),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ['mentors', 'huddles', cohortId, weekNumber],
      }),
  });
}

export function useSessionAttendance(sessionId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['mentors', 'huddles', 'attendance', sessionId, activeOrganizationId],
    queryFn: () => listSessionAttendance(sessionId as string, activeOrganizationId),
    enabled: Boolean(sessionId) && Boolean(activeOrganizationId),
  });
}

export function useRecordAttendance(sessionId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RecordHuddleAttendanceRequest) =>
      recordAttendance(sessionId, body, activeOrganizationId),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ['mentors', 'huddles', 'attendance', sessionId],
      }),
  });
}
