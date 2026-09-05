import type { CurriculumSnapshotModule } from '../../catalog/services/curriculum-snapshot.service';
import type { CohortEntity } from '../../cohorts/entities/cohort.entity';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import type { ProgressionContext } from './progression.service';
import { DeadlineService } from './deadline.service';
import type { ProgressionService } from './progression.service';

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

function fakeContext(overrides: Partial<ProgressionContext> = {}): ProgressionContext {
  const enrollment = {
    joinedAt: new Date('2027-01-01T00:00:00Z'),
  } as EnrollmentEntity;
  const cohort = { startsAt: new Date('2026-12-25T00:00:00Z') } as CohortEntity;

  return {
    enrollment,
    cohort,
    track: null,
    modules: [],
    moduleLockStates: new Map(),
    completions: [],
    acknowledgments: [],
    submissions: [],
    completedLessonIds: new Set(),
    acknowledgedResourceIds: new Set(),
    submittedTaskIds: new Set(),
    ...overrides,
  };
}

describe('DeadlineService.computeFromContext', () => {
  const service = new DeadlineService({} as ProgressionService);

  it("module 1 unlocks at the enrollment's join date", () => {
    const ctx = fakeContext({ modules: [fakeModule()] });
    const dates = service.computeFromContext(ctx);
    expect(dates.get('module-1')).toEqual(ctx.enrollment.joinedAt);
  });

  it("falls back to the cohort's scheduled start when the enrollment hasn't joined yet", () => {
    const ctx = fakeContext({
      enrollment: { joinedAt: null } as EnrollmentEntity,
      modules: [fakeModule()],
    });
    const dates = service.computeFromContext(ctx);
    expect(dates.get('module-1')).toEqual(ctx.cohort.startsAt);
  });

  it('a module with no required items is satisfied the instant it unlocks', () => {
    const moduleTwo = fakeModule({ id: 'module-2', weekNumber: 2 });
    const ctx = fakeContext({ modules: [fakeModule(), moduleTwo] });
    const dates = service.computeFromContext(ctx);
    // module-1 has no requirements either, so module-2 unlocks at the same instant module-1 did.
    expect(dates.get('module-2')).toEqual(dates.get('module-1'));
  });

  it('module 2 unlock is null while module 1 is not yet satisfied', () => {
    const lesson = {
      id: 'lesson-1',
      completionRequired: true,
    } as CurriculumSnapshotModule['lessons'][number];
    const moduleOne = fakeModule({ lessons: [lesson] });
    const moduleTwo = fakeModule({ id: 'module-2', weekNumber: 2 });
    const ctx = fakeContext({ modules: [moduleOne, moduleTwo], completions: [] });

    const dates = service.computeFromContext(ctx);
    expect(dates.get('module-1')).not.toBeNull();
    expect(dates.get('module-2')).toBeNull();
  });

  it('module 2 unlocks at the latest completion/acknowledgment/submission timestamp among module 1s required items', () => {
    const lesson = {
      id: 'lesson-1',
      completionRequired: true,
    } as CurriculumSnapshotModule['lessons'][number];
    const resource = {
      id: 'resource-1',
      isRequired: true,
    } as CurriculumSnapshotModule['resources'][number];
    const moduleOne = fakeModule({ lessons: [lesson], resources: [resource] });
    const moduleTwo = fakeModule({ id: 'module-2', weekNumber: 2 });

    const earlier = new Date('2027-01-02T00:00:00Z');
    const later = new Date('2027-01-05T00:00:00Z');
    const ctx = fakeContext({
      modules: [moduleOne, moduleTwo],
      completions: [{ lessonId: 'lesson-1', completedAt: earlier } as never],
      acknowledgments: [{ resourceId: 'resource-1', acknowledgedAt: later } as never],
    });

    const dates = service.computeFromContext(ctx);
    expect(dates.get('module-2')).toEqual(later);
  });

  it('due date = module unlock date + dueOffsetDays', () => {
    const ctx = fakeContext({ modules: [fakeModule()] });
    const dates = service.computeFromContext(ctx);
    const dueDate = service.computeTaskDueDate(dates, 'module-1', { dueOffsetDays: 7 });
    expect(dueDate).toEqual(new Date('2027-01-08T00:00:00Z'));
  });

  it('due date is null when the module has not unlocked', () => {
    const dates = new Map([['module-1', null]]);
    expect(service.computeTaskDueDate(dates, 'module-1', { dueOffsetDays: 7 })).toBeNull();
  });

  it('due date is null when the task has no dueOffsetDays', () => {
    const ctx = fakeContext({ modules: [fakeModule()] });
    const dates = service.computeFromContext(ctx);
    expect(service.computeTaskDueDate(dates, 'module-1', { dueOffsetDays: null })).toBeNull();
  });
});
