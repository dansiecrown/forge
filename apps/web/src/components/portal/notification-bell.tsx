import { useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationPanel } from './notification-panel';

/** Notification Center — UI only, per the milestone brief ("no backend
 * notification engine"). Hardcoded placeholder items, mark-as-read as local
 * component state only; genuinely zero network calls (verified live, not
 * just intended — see the live verification pass). The full `Notification`
 * entity and `.../notification-preferences` endpoints documented in
 * `docs/database-design.md` §5 / `docs/api-specification.md` §4.9 remain
 * correctly deferred to roadmap Phase 10. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex size-9 items-center justify-center rounded-control text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand"
            aria-hidden="true"
          />
        ) : null}
      </button>
      {open ? (
        <NotificationPanel onClose={() => setOpen(false)} onAllRead={() => setUnreadCount(0)} />
      ) : null}
    </div>
  );
}
