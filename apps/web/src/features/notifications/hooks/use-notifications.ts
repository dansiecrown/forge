import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@forge/api-contract';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '../api/notifications-api';

const LIST_KEY = ['notifications', 'list'];

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: LIST_KEY });
}

/** Paged list for the full Notification Center page. */
export function useNotificationsList() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, []);

  const query = useQuery({
    queryKey: [...LIST_KEY, 'full', cursor],
    queryFn: () => listNotifications({ cursor, limit: 50 }),
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

/** Compact recent list for the header bell dropdown — a handful of the most
 * recent notifications regardless of read state, matching the panel's
 * existing "recent activity" shape. */
export function useRecentNotifications(limit = 8) {
  return useQuery({
    queryKey: [...LIST_KEY, 'recent', limit],
    queryFn: () => listNotifications({ limit }),
  });
}

/** A cheap existence check for the bell's unread dot — never an exact count
 * (today's design is dot-only, not a badge number), so one row is enough. */
export function useHasUnreadNotifications() {
  const query = useQuery({
    queryKey: [...LIST_KEY, 'has-unread'],
    queryFn: () => listNotifications({ unreadOnly: true, limit: 1 }),
    refetchInterval: 60_000,
  });
  return (query.data?.items.length ?? 0) > 0;
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkNotificationUnread() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => markNotificationUnread(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });
}
