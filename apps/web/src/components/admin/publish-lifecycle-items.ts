import type { ActionsMenuItem } from './actions-menu';

/** The curriculum family (Learning Track/Course/WeeklyModule/Lesson/
 * LearningResource/PracticalTask) shares one identical draft → published →
 * archived lifecycle with the same three actions — see
 * docs/adr/0006-curriculum-learning-engine.md's "one shared namespace"
 * note. Six pages had hand-copied the same lifecycle-button JSX; this is
 * the one place that logic lives now. Archiving still requires the caller
 * to confirm via `ConfirmDialog` — `onArchiveRequest` only opens it. */
export function buildPublishLifecycleItems(options: {
  status: 'draft' | 'published' | 'archived';
  onPublish: () => void;
  onArchiveRequest: () => void;
  onRestore: () => void;
  publishing?: boolean;
  restoring?: boolean;
}): ActionsMenuItem[] {
  const items: ActionsMenuItem[] = [];
  if (options.status === 'draft') {
    items.push({ label: 'Publish', loading: options.publishing, onSelect: options.onPublish });
  }
  if (options.status !== 'archived') {
    items.push({ label: 'Archive', tone: 'danger', onSelect: options.onArchiveRequest });
  }
  if (options.status === 'archived') {
    items.push({ label: 'Restore', loading: options.restoring, onSelect: options.onRestore });
  }
  return items;
}
