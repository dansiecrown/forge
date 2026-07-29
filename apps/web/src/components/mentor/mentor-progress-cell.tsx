import { ProgressRing } from '@/components/portal/progress-ring';

/** Small `ProgressRing` for a `DataTable` row — the ring itself already
 * renders the percentage, so no separate text label is added. */
export function MentorProgressCell({ percent }: { percent: number }) {
  return <ProgressRing percent={percent} size={40} strokeWidth={5} />;
}
