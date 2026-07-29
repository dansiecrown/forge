import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PLACEHOLDER_NOTIFICATIONS } from '@/components/portal/notification-data';
import { cn } from '@/utils';

/** Full-page Notification Center — UI only, same placeholder data as the
 * header bell dropdown (`components/portal/notification-panel.tsx`). No
 * backend notification engine exists this milestone. */
export function NotificationsPage() {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  return (
    <div>
      <AdminPageHeader
        title="Notifications"
        action={
          <Button
            variant="secondary"
            onClick={() => setReadIds(new Set(PLACEHOLDER_NOTIFICATIONS.map((n) => n.id)))}
          >
            Mark all read
          </Button>
        }
      />
      <div className="space-y-2">
        {PLACEHOLDER_NOTIFICATIONS.map((notification) => {
          const Icon = notification.icon;
          const isRead = readIds.has(notification.id);
          return (
            <Card
              key={notification.id}
              className={cn('flex cursor-pointer items-start gap-3 py-4', !isRead && 'bg-brand/5')}
              onClick={() => setReadIds((prev) => new Set(prev).add(notification.id))}
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">{notification.title}</p>
                <p className="text-sm text-muted-foreground">{notification.meta}</p>
              </div>
              {!isRead ? (
                <span
                  className="ml-auto mt-1.5 size-2 shrink-0 rounded-full bg-brand"
                  aria-hidden="true"
                />
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
