import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';
import { PLACEHOLDER_NOTIFICATIONS } from './notification-data';

/** Placeholder content only — see `NotificationBell`'s doc comment. */
export function NotificationPanel({
  onClose,
  onAllRead,
}: {
  onClose: () => void;
  onAllRead: () => void;
}) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  function markAllRead() {
    setReadIds(new Set(PLACEHOLDER_NOTIFICATIONS.map((n) => n.id)));
    onAllRead();
  }

  return (
    <div className="absolute right-0 top-11 z-20 w-80 rounded-card border border-border bg-surface p-2 shadow-subtle">
      <div className="flex items-center justify-between px-2 py-1.5">
        <p className="text-sm font-medium text-foreground">Notifications</p>
        <Button
          variant="tertiary"
          className="h-auto min-h-0 px-1 py-0 text-xs"
          onClick={markAllRead}
        >
          Mark all read
        </Button>
      </div>
      <ul className="max-h-80 space-y-0.5 overflow-y-auto">
        {PLACEHOLDER_NOTIFICATIONS.map((notification) => {
          const Icon = notification.icon;
          const isRead = readIds.has(notification.id);
          return (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => setReadIds((prev) => new Set(prev).add(notification.id))}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-control px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2',
                  !isRead && 'bg-brand/5',
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {notification.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {notification.meta}
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
        })}
      </ul>
      <div className="border-t border-border px-2 pt-1.5">
        <Button
          variant="tertiary"
          className="h-auto min-h-0 w-full px-1 py-1 text-xs"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  );
}
