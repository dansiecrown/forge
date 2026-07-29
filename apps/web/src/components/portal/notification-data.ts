import { Award, Calendar, Clock, MessageSquare, Megaphone, type LucideIcon } from 'lucide-react';

export interface PlaceholderNotification {
  id: string;
  icon: LucideIcon;
  title: string;
  meta: string;
}

/** Shared placeholder data for the Notification Center — used by both the
 * header bell dropdown and the full `/portal/notifications` page. UI only,
 * no backend — see `NotificationBell`'s doc comment. */
export const PLACEHOLDER_NOTIFICATIONS: PlaceholderNotification[] = [
  {
    id: 'weekly-unlock',
    icon: Clock,
    title: 'Week 2 is now unlocked',
    meta: 'You completed everything required in Week 1.',
  },
  {
    id: 'deadline-reminder',
    icon: Calendar,
    title: 'Practical task due in 2 days',
    meta: '"Build a page" is due soon.',
  },
  {
    id: 'mentor-message',
    icon: MessageSquare,
    title: 'New note from your mentor',
    meta: 'Feedback on your latest submission.',
  },
  {
    id: 'announcement',
    icon: Megaphone,
    title: 'Cohort announcement',
    meta: 'A new resource was added to Week 1.',
  },
  {
    id: 'feedback-received',
    icon: Award,
    title: 'Feedback received',
    meta: 'Your mentor reviewed your submission.',
  },
];
