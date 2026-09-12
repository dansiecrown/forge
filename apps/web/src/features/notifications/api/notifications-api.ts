import type { Notification } from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

// Self-scoped only (`GET /me/notifications`) — no `X-Organization-Id`
// needed, matching the backend controller (see
// NotificationsController's own doc comment).

export function listNotifications(options: {
  unreadOnly?: boolean;
  cursor?: string;
  limit?: number;
}): Promise<Page<Notification>> {
  const search = new URLSearchParams();
  if (options.unreadOnly) search.set('unreadOnly', 'true');
  if (options.cursor) search.set('cursor', options.cursor);
  if (options.limit) search.set('limit', String(options.limit));
  const query = search.toString();
  return apiRequestPage<Notification>(`/me/notifications${query ? `?${query}` : ''}`);
}

export function markNotificationRead(id: string): Promise<void> {
  return apiRequest<void>(`/me/notifications/${id}/actions/mark-read`, { method: 'POST' });
}

/** The explicit, manual "set it back to unread" exception — never automatic. */
export function markNotificationUnread(id: string): Promise<void> {
  return apiRequest<void>(`/me/notifications/${id}/actions/mark-unread`, { method: 'POST' });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiRequest<void>('/me/notifications/actions/mark-all-read', { method: 'POST' });
}
