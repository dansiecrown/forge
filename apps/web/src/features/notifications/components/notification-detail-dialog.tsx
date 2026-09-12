import type { Notification } from '@forge/api-contract';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Shown when a notification has nowhere to navigate to (see
 * `resolveNotificationTarget`) — the notification's own title/body is
 * already the complete content in that case, so this loses nothing. */
export function NotificationDetailDialog({
  notification,
  onClose,
}: {
  notification: Notification | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={notification !== null}
      onClose={onClose}
      title={notification?.title ?? ''}
      description={notification ? new Date(notification.createdAt).toLocaleString() : undefined}
    >
      <p className="whitespace-pre-wrap text-sm text-foreground">{notification?.body}</p>
      <div className="mt-5 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
