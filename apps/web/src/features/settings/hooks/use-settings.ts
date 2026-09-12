import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangePasswordRequest,
  ConfirmMfaEnrollmentRequest,
  DisableMfaRequest,
} from '@forge/api-contract';
import {
  changePassword,
  confirmMfaEnrollment,
  disableMfa,
  enrollMfa,
  fetchMe,
  listSessions,
  revokeSession,
  updateMe,
} from '@/features/identity';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      displayName?: string;
      timezone?: string;
      locale?: string;
      username?: string;
    }) => updateMe(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => changePassword(body),
  });
}

export function useSessions() {
  return useQuery({ queryKey: ['auth', 'sessions'], queryFn: listSessions });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

export function useEnrollMfa() {
  return useMutation({ mutationFn: enrollMfa });
}

export function useConfirmMfaEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfirmMfaEnrollmentRequest) => confirmMfaEnrollment(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DisableMfaRequest) => disableMfa(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}
