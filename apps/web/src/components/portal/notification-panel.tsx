import type { LucideIcon } from 'lucide-react';
import { Bell, Megaphone, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { NotificationDetailDialog } from '@/features/notifications/components/notification-detail-dialog';
import { useNotificationClick } from '@/features/notifications/hooks/use-notification-click';
import {
  useMarkAllNotificationsRead,
  useRecentNotifications,
} from '@/features/notifications/hooks/use-notifications';
import {
  notificationsPathFor,
  type NotificationRole,
} from '@/features/notifications/utils/resolve-notification-target';
import { cn } from '@/utils';

const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
  'chat.message.reply': MessageSquare,
  'announcement.published': Megaphone,
};

/** Real notification data — see `NotificationBell`'s doc comment. */
export function NotificationPanel({
  role,
  onClose,
}: {
  role: NotificationRole;
  onClose: () => void;
}) {
  const { data, isLoading } = useRecentNotifications();
  const { handleClick, detail, closeDetail } = useNotificationClick(role);
  const markAllRead = useMarkAllNotificationsRead();
  const items = data?.items ?? [];
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div className="absolute right-0 top-11 z-20 w-80 rounded-card border border-border bg-surface p-2 shadow-subtle">
      <div className="flex items-center justify-between px-2 py-1.5">
        <p className="text-sm font-medium text-foreground">Notifications</p>
        {hasUnread ? (
          <Button
            variant="tertiary"
            className="h-auto min-h-0 px-1 py-0 text-xs"
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Mark all read
          </Button>
        ) : null}
      </div>
      <ul className="max-h-80 space-y-0.5 overflow-y-auto">
        {isLoading ? (
          <li className="px-2 py-3 text-sm text-muted-foreground">Loading…</li>
        ) : items.length === 0 ? (
          <li className="px-2 py-3 text-sm text-muted-foreground">Nothing here yet.</li>
        ) : (
          items.map((notification) => {
            const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell;
            const isRead = Boolean(notification.readAt);
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => handleClick(notification)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-control px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2',
                    !isRead && 'bg-brand/5',
                  )}
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {notification.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {notification.body}
                    </span>
                  </span>
                  {!isRead ? (
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-border px-2 pt-1.5">
        <Link
          to={notificationsPathFor(role)}
          onClick={onClose}
          className="rounded-control px-1 py-1 text-xs text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          View all
        </Link>
        <Button variant="tertiary" className="h-auto min-h-0 px-1 py-1 text-xs" onClick={onClose}>
          Close
        </Button>
      </div>
      <NotificationDetailDialog notification={detail} onClose={closeDetail} />
    </div>
  );
}
