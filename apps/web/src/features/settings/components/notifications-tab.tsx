import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const STORAGE_KEY = 'forge.notificationPreferences';

interface Preferences {
  weeklyUnlock: boolean;
  deadlineReminder: boolean;
  mentorMessage: boolean;
  announcement: boolean;
  feedbackReceived: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  weeklyUnlock: true,
  deadlineReminder: true,
  mentorMessage: true,
  announcement: true,
  feedbackReceived: true,
};

function readStoredPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

const ROWS: { key: keyof Preferences; label: string; description: string }[] = [
  { key: 'weeklyUnlock', label: 'Weekly unlock', description: 'A new week becomes available.' },
  {
    key: 'deadlineReminder',
    label: 'Deadline reminders',
    description: 'A practical task is due soon.',
  },
  { key: 'mentorMessage', label: 'Mentor messages', description: 'Your mentor sends you a note.' },
  { key: 'announcement', label: 'Announcements', description: 'Cohort-wide announcements.' },
  {
    key: 'feedbackReceived',
    label: 'Feedback received',
    description: 'Your mentor reviews a submission.',
  },
];

/** Local-only preferences — no backend notification engine exists this
 * milestone (see `NotificationBell`'s doc comment). Persisted to
 * `localStorage` purely for UI continuity across reloads, not synced
 * anywhere. */
export function NotificationsTab() {
  const [preferences, setPreferences] = useState<Preferences>(() => readStoredPreferences());

  function update(key: keyof Preferences, value: boolean) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Notification preferences</CardTitle>
        <CardDescription>
          Choose which notifications appear in your notification center.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {ROWS.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.description}</p>
              </div>
              <Switch
                checked={preferences[row.key]}
                onChange={(checked) => update(row.key, checked)}
                label={row.label}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
