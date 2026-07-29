import type { CurriculumSnapshotModule } from '../../catalog/services/curriculum-snapshot.service';
import type { ProgressionContext } from '../services/progression.service';

/** Formats a Date as its local calendar-date string in the given IANA
 * timezone (`YYYY-MM-DD`), using the runtime's built-in `Intl` — no new
 * date library. Two different instants on the same local calendar day
 * format identically, which is exactly what streak-counting needs. */
function toLocalDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Streak = consecutive calendar days (in the given timezone), counting
 * backward from today, with at least one completion/acknowledgment/
 * submission event. No new event-log table — computed from the same rows
 * `ProgressionContext` already loads (docs/adr/0007-student-experience.md:
 * this is an estimate derived from existing data, not measured session
 * activity). */
export function computeStreakDays(
  ctx: Pick<ProgressionContext, 'completions' | 'acknowledgments' | 'submissions'>,
  timezone: string,
  now: Date = new Date(),
): number {
  const eventDates: Date[] = [
    ...ctx.completions.map((c) => c.completedAt),
    ...ctx.acknowledgments.map((a) => a.acknowledgedAt),
    ...ctx.submissions.filter((s) => s.submittedAt !== null).map((s) => s.submittedAt as Date),
  ];
  const activeDays = new Set(eventDates.map((d) => toLocalDateKey(d, timezone)));

  let streak = 0;
  const cursor = new Date(now);
  for (;;) {
    const key = toLocalDateKey(cursor, timezone);
    if (!activeDays.has(key)) {
      break;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Latest completion/acknowledgment/submission timestamp — the same event
 * rows `computeStreakDays` reads, reduced to a single "last seen active"
 * instant rather than a day-count. `null` means no activity has ever been
 * recorded for this enrollment. Used by the Mentor Portal's at-risk
 * heuristics below — see docs/adr/0008-mentor-experience.md Decision 6:
 * "simple, transparent, reason-carrying heuristics computed on read from
 * existing progression timestamps," not a measured-engagement score. */
export function computeLastActivityAt(
  ctx: Pick<ProgressionContext, 'completions' | 'acknowledgments' | 'submissions'>,
): Date | null {
  const eventDates: Date[] = [
    ...ctx.completions.map((c) => c.completedAt),
    ...ctx.acknowledgments.map((a) => a.acknowledgedAt),
    ...ctx.submissions.filter((s) => s.submittedAt !== null).map((s) => s.submittedAt as Date),
  ];
  if (eventDates.length === 0) {
    return null;
  }
  return new Date(Math.max(...eventDates.map((d) => d.getTime())));
}

/** No recorded activity in the last `thresholdDays` (or ever) — the
 * "hasn't touched the curriculum in a while" flag on the mentor roster. */
export function isInactive(
  lastActivityAt: Date | null,
  now: Date = new Date(),
  thresholdDays = 7,
): boolean {
  if (!lastActivityAt) {
    return true;
  }
  const daysSince = (now.getTime() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000);
  return daysSince >= thresholdDays;
}

/** More than `marginPercent` behind the cohort's median progress — a
 * relative, per-cohort comparison rather than an absolute threshold, so it
 * adapts to how far along the cohort as a whole actually is. */
export function isFallingBehindCohortMedian(
  progressPercent: number,
  cohortMedianPercent: number,
  marginPercent = 15,
): boolean {
  return cohortMedianPercent - progressPercent >= marginPercent;
}

/** Sum of `estimatedDurationMinutes` across completed lessons and
 * acknowledged resources — labeled `estimatedMinutesLearned` wherever this
 * is surfaced in the API, honestly naming it as an estimate rather than
 * measured engagement (same precedent as `estimatedCompletionDate`). */
export function computeEstimatedMinutesLearned(
  modules: CurriculumSnapshotModule[],
  completedLessonIds: Set<string>,
  acknowledgedResourceIds: Set<string>,
): number {
  let total = 0;
  for (const module of modules) {
    for (const lesson of module.lessons) {
      if (completedLessonIds.has(lesson.id)) {
        total += lesson.estimatedDurationMinutes ?? 0;
      }
    }
    for (const resource of module.resources) {
      if (acknowledgedResourceIds.has(resource.id)) {
        total += resource.estimatedDurationMinutes ?? 0;
      }
    }
  }
  return total;
}
