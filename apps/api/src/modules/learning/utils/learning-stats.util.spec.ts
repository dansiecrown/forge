import type { CurriculumSnapshotModule } from '../../catalog/services/curriculum-snapshot.service';
import { computeEstimatedMinutesLearned, computeStreakDays } from './learning-stats.util';

const TIMEZONE = 'America/Sao_Paulo'; // DST-observing-adjacent timezone, per the plan's test requirement.

function ctxWith(events: Date[]) {
  return {
    completions: events.map((completedAt) => ({ lessonId: 'x', completedAt }) as never),
    acknowledgments: [],
    submissions: [],
  };
}

describe('computeStreakDays', () => {
  it('is 0 with no activity', () => {
    expect(computeStreakDays(ctxWith([]), TIMEZONE, new Date('2027-03-15T12:00:00Z'))).toBe(0);
  });

  it('counts a single active day (today) as a streak of 1', () => {
    const now = new Date('2027-03-15T12:00:00Z');
    expect(computeStreakDays(ctxWith([now]), TIMEZONE, now)).toBe(1);
  });

  it('counts consecutive days backward from today', () => {
    const now = new Date('2027-03-15T12:00:00Z');
    const events = [now, new Date('2027-03-14T12:00:00Z'), new Date('2027-03-13T12:00:00Z')];
    expect(computeStreakDays(ctxWith(events), TIMEZONE, now)).toBe(3);
  });

  it('stops counting at the first gap', () => {
    const now = new Date('2027-03-15T12:00:00Z');
    const events = [
      now,
      new Date('2027-03-14T12:00:00Z'),
      // gap on the 13th
      new Date('2027-03-12T12:00:00Z'),
    ];
    expect(computeStreakDays(ctxWith(events), TIMEZONE, now)).toBe(2);
  });

  it('counts multiple events on the same local day once', () => {
    const now = new Date('2027-03-15T10:00:00Z');
    const events = [now, new Date('2027-03-15T14:00:00Z'), new Date('2027-03-15T18:00:00Z')];
    expect(computeStreakDays(ctxWith(events), TIMEZONE, now)).toBe(1);
  });

  it('respects the caller timezone at a day boundary', () => {
    // 2027-03-15T02:30:00Z is 2027-03-14 23:30 in America/Sao_Paulo (UTC-3) —
    // a naive UTC-only comparison would place this on the 15th instead.
    const lateUtcButPriorLocalDay = new Date('2027-03-15T02:30:00Z');
    const now = new Date('2027-03-14T20:00:00Z'); // same local day (14th) in Sao Paulo
    expect(computeStreakDays(ctxWith([lateUtcButPriorLocalDay]), TIMEZONE, now)).toBe(1);
  });
});

describe('computeEstimatedMinutesLearned', () => {
  function fakeModule(overrides: Partial<CurriculumSnapshotModule> = {}): CurriculumSnapshotModule {
    return {
      id: 'module-1',
      weekNumber: 1,
      title: 'Week 1',
      objectives: [],
      summary: null,
      estimatedStudyHours: null,
      status: 'published',
      requiresMentorHuddle: false,
      requiresPracticalWork: false,
      unlockRules: null,
      huddleScheduleMetadata: null,
      huddleMeetingLink: null,
      mentorHuddleNotes: null,
      huddleAttendanceRequired: false,
      lessons: [],
      resources: [],
      practicalTasks: [],
      ...overrides,
    };
  }

  it('sums only completed lessons and acknowledged resources', () => {
    const modules = [
      fakeModule({
        lessons: [
          { id: 'l1', estimatedDurationMinutes: 30 } as never,
          { id: 'l2', estimatedDurationMinutes: 45 } as never,
        ],
        resources: [{ id: 'r1', estimatedDurationMinutes: 15 } as never],
      }),
    ];
    const total = computeEstimatedMinutesLearned(modules, new Set(['l1']), new Set(['r1']));
    expect(total).toBe(45); // l2 not completed, so excluded
  });

  it('treats a null estimatedDurationMinutes as 0', () => {
    const modules = [
      fakeModule({ lessons: [{ id: 'l1', estimatedDurationMinutes: null } as never] }),
    ];
    expect(computeEstimatedMinutesLearned(modules, new Set(['l1']), new Set())).toBe(0);
  });
});
