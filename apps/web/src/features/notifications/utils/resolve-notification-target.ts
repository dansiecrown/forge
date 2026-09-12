import type { Notification } from '@forge/api-contract';

export type NotificationRole = 'admin' | 'mentor' | 'student';

/** Where clicking a notification should navigate, per the caller's role —
 * or `null` when there's nowhere to go yet. A `null` result is the caller's
 * cue to show the notification's own title/body in a popup instead, per the
 * flaw's own resolution: "For notifications that don't [have a navigable
 * source], it should open a popup with the notification details." Never
 * fabricates a destination that isn't real — an existing, working route
 * only. */
export function resolveNotificationTarget(
  role: NotificationRole,
  notification: Notification,
): string | null {
  switch (notification.type) {
    case 'chat.message.reply':
      if (role === 'student') return '/portal/chat';
      if (role === 'mentor') return '/mentor/chat';
      // Admin does have a chat surface now (the Fellowship detail page's
      // Chat tab), but this notification only carries the message's own id
      // (`entityType: 'fellowship_chat_message'`), not which Fellowship it
      // belongs to — resolving that would need a new lookup this pass
      // doesn't add, so this correctly falls through to the popup rather
      // than fabricating a link.
      return null;
    case 'announcement.published':
      // The only announcement UI today is the Admin's own management page —
      // there's no recipient-facing "announcements I've received" page for
      // Student/Mentor, so the notification's own body (already the full
      // announcement text) is the only place they can read it.
      if (role === 'admin') return '/admin/announcements';
      return null;
    case 'dm.message.received':
      // `entityId` is the conversation id — deep-link straight to it.
      return `${messagesPathFor(role)}?conversationId=${notification.entityId}`;
    default:
      return null;
  }
}

const NOTIFICATIONS_PATH: Record<NotificationRole, string> = {
  admin: '/admin/notifications',
  mentor: '/mentor/notifications',
  student: '/portal/notifications',
};

/** The full Notification Center's own route, per role — used by the bell
 * dropdown's "View all" link. */
export function notificationsPathFor(role: NotificationRole): string {
  return NOTIFICATIONS_PATH[role];
}

const MESSAGES_PATH: Record<NotificationRole, string> = {
  admin: '/admin/messages',
  mentor: '/mentor/messages',
  student: '/portal/messages',
};

/** The Direct Messages page's own route, per role — used to deep-link a
 * `dm.message.received` notification straight to its conversation. */
export function messagesPathFor(role: NotificationRole): string {
  return MESSAGES_PATH[role];
}
