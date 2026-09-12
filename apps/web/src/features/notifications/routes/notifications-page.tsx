import type { LucideIcon } from 'lucide-react';
import { Bell, Megaphone, MessageSquare } from 'lucide-react';
import type { Notification } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/portal/empty-state';
import { LoadMore } from '@/components/admin/load-more';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardErrorPanel, DashboardState } from '@/components/dashboard-state';
import { cn } from '@/utils';
import { NotificationDetailDialog } from '../components/notification-detail-dialog';
import { useNotificationClick } from '../hooks/use-notification-click';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useNotificationsList,
} from '../hooks/use-notifications';
import type { NotificationRole } from '../utils/resolve-notification-target';

const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
  'chat.message.reply': MessageSquare,
  'announcement.published': Megaphone,
};

function iconFor(type: string): LucideIcon {
  return NOTIFICATION_ICONS[type] ?? Bell;
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

function NotificationRow({
  notification,
  onOpen,
  onToggleRead,
  togglePending,
}: {
  notification: Notification;
  onOpen: () => void;
  onToggleRead: () => void;
  togglePending: boolean;
}) {
  const Icon = iconFor(notification.type);
  const isRead = Boolean(notification.readAt);

  return (
    <Card
      className={cn('flex cursor-pointer items-start gap-3 py-4', !isRead && 'bg-brand/5')}
      onClick={onOpen}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        <p className="truncate text-sm text-muted-foreground">{notification.body}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(notification.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {!isRead ? (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
        ) : null}
        <Button
          variant="tertiary"
          className="h-auto min-h-0 px-1 py-0 text-xs"
          loading={togglePending}
          onClick={(event) => {
            event.stopPropagation();
            onToggleRead();
          }}
        >
          {isRead ? 'Mark unread' : 'Mark read'}
        </Button>
      </div>
    </Card>
  );
}

export function NotificationsPage({ role = 'student' }: { role?: NotificationRole }) {
  const { rows, isLoading, error, hasMore, loadMore } = useNotificationsList();
  const { handleClick, detail, closeDetail } = useNotificationClick(role);
  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = rows.filter((n) => !n.readAt);
  const read = rows.filter((n) => n.readAt);
  const status = isLoading ? 'loading' : error ? 'error' : rows.length === 0 ? 'empty' : 'success';

  function toggleRead(notification: Notification) {
    if (notification.readAt) {
      markUnread.mutate(notification.id);
    } else {
      markRead.mutate(notification.id);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Notifications"
        action={
          unread.length > 0 ? (
            <Button
              variant="secondary"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          ) : null
        }
      />

      <DashboardState status={status}>
        <DashboardState.Loading>
          <NotificationsSkeleton />
        </DashboardState.Loading>

        <DashboardState.Error>
          <DashboardErrorPanel
            description="Couldn't load your notifications."
            onRetry={() => window.location.reload()}
          />
        </DashboardState.Error>

        <DashboardState.Empty>
          <EmptyState
            title="No notifications yet"
            description="You'll see replies, announcements, and other updates here."
          />
        </DashboardState.Empty>

        <DashboardState.Content>
          <div className="space-y-6">
            {unread.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Unread ({unread.length})
                </h2>
                {unread.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={() => handleClick(notification)}
                    onToggleRead={() => toggleRead(notification)}
                    togglePending={
                      (markRead.isPending && markRead.variables === notification.id) ||
                      (markUnread.isPending && markUnread.variables === notification.id)
                    }
                  />
                ))}
              </div>
            ) : null}

            {read.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">Read</h2>
                {read.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={() => handleClick(notification)}
                    onToggleRead={() => toggleRead(notification)}
                    togglePending={
                      (markRead.isPending && markRead.variables === notification.id) ||
                      (markUnread.isPending && markUnread.variables === notification.id)
                    }
                  />
                ))}
              </div>
            ) : null}

            <LoadMore hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />
          </div>
        </DashboardState.Content>
      </DashboardState>

      <NotificationDetailDialog notification={detail} onClose={closeDetail} />
    </div>
  );
}
