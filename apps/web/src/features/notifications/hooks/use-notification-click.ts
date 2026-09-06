import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@forge/api-contract';
import type { NotificationRole } from '../utils/resolve-notification-target';
import { resolveNotificationTarget } from '../utils/resolve-notification-target';
import { useMarkNotificationRead } from './use-notifications';

/** Shared click behavior for both the header bell dropdown and the full
 * Notification Center page: mark read, then navigate to the source when one
 * exists, or surface it via `detail` (render a `NotificationDetailDialog`
 * bound to it) when it doesn't. */
export function useNotificationClick(role: NotificationRole) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const [detail, setDetail] = useState<Notification | null>(null);

  function handleClick(notification: Notification) {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    const target = resolveNotificationTarget(role, notification);
    if (target) {
      navigate(target);
    } else {
      setDetail(notification);
    }
  }

  return { handleClick, detail, closeDetail: () => setDetail(null) };
}
