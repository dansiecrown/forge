import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/contexts/organization-context';
import type { AdminUser } from '../api/admin-users-api';
import {
  forcePasswordReset,
  getAdminUser,
  getLoginHistory,
  listAdminUsers,
  listUserSessions,
  reactivateUser,
  resetMfa,
  revokeAllSessions,
  revokeSession,
  suspendUser,
} from '../api/admin-users-api';

export function useAdminUsersList(q: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<AdminUser[]>([]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [q]);

  const query = useQuery({
    queryKey: ['admin-users', 'list', q, cursor, activeOrganizationId],
    queryFn: () => listAdminUsers(q || undefined, cursor, activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
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

export function useAdminUser(userId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['admin-users', 'detail', userId, activeOrganizationId],
    queryFn: () => getAdminUser(userId as string, activeOrganizationId),
    enabled: Boolean(userId && activeOrganizationId),
  });
}

export function useAdminUserActions(userId: string, organizationId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin-users', 'detail', userId] });

  const suspend = useMutation({
    mutationFn: () => suspendUser(userId, organizationId),
    onSuccess: invalidate,
  });
  const reactivate = useMutation({
    mutationFn: () => reactivateUser(userId, organizationId),
    onSuccess: invalidate,
  });
  const mfaReset = useMutation({ mutationFn: () => resetMfa(userId, organizationId) });
  const passwordReset = useMutation({
    mutationFn: () => forcePasswordReset(userId, organizationId),
  });
  const revokeAll = useMutation({
    mutationFn: () => revokeAllSessions(userId, organizationId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin-users', 'sessions', userId] }),
  });

  return { suspend, reactivate, mfaReset, passwordReset, revokeAll };
}

export function useUserSessions(userId: string, organizationId: string, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-users', 'sessions', userId],
    queryFn: () => listUserSessions(userId, organizationId),
    enabled: Boolean(userId && organizationId && enabled),
  });
  const revoke = useMutation({
    mutationFn: (sessionId: string) => revokeSession(userId, sessionId, organizationId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin-users', 'sessions', userId] }),
  });
  return { ...query, revoke };
}

export function useLoginHistory(userId: string, organizationId: string, enabled = true) {
  return useQuery({
    queryKey: ['admin-users', 'login-history', userId],
    queryFn: () => getLoginHistory(userId, organizationId),
    enabled: Boolean(userId && organizationId && enabled),
  });
}
