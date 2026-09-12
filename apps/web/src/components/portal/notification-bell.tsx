import { useState } from 'react';
import { Bell } from 'lucide-react';
import type { NotificationRole } from '@/features/notifications/utils/resolve-notification-target';
import { useHasUnreadNotifications } from '@/features/notifications/hooks/use-notifications';
import { NotificationPanel } from './notification-panel';

/** Real notification data (`GET /me/notifications`) — see
 * docs/ENGINEERING_DECISIONS.md's 2026-09-06 entry for the flaw this
 * replaces (placeholder data, no backend wiring). Mounted in all three role
 * layouts now, each passing its own `role` so click-through targets
 * (`resolveNotificationTarget`) resolve to that role's own routes. */
export function NotificationBell({ role }: { role: NotificationRole }) {
  const [open, setOpen] = useState(false);
  const hasUnread = useHasUnreadNotifications();

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex size-9 items-center justify-center rounded-control text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Bell className="size-4" aria-hidden="true" />
        {hasUnread ? (
          <span
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand"
            aria-hidden="true"
          />
        ) : null}
      </button>
      {open ? <NotificationPanel role={role} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
