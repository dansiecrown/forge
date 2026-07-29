import { Injectable } from '@nestjs/common';
import type { CurriculumSnapshotTask } from '../../catalog/services/curriculum-snapshot.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import type { ProgressionContext } from './progression.service';
import { ProgressionService } from './progression.service';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Computes, per enrollment, when each Weekly Module became available and
 * when a Practical Task's relative `dueOffsetDays` resolves to an absolute
 * date. No new persisted "unlocked at" column — see
 * docs/adr/0007-student-experience.md: Module 1 unlocks at the enrollment's
 * own join date (falling back to the cohort's scheduled start if the
 * learner hasn't formally activated yet); Module N (N>1) unlocks the moment
 * Module N-1's required items are all satisfied — the latest of their
 * completion/acknowledgment/submission timestamps — or is `null` if Module
 * N-1 isn't yet satisfied. A module with no required items at all is
 * satisfied the instant it unlocks. */
@Injectable()
export class DeadlineService {
  constructor(private readonly progressionService: ProgressionService) {}

  async computeModuleUnlockDates(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<Map<string, Date | null>> {
    const ctx = await this.progressionService.buildContext(scope, enrollmentId, callerId);
    return this.computeFromContext(ctx);
  }

  computeFromContext(ctx: ProgressionContext): Map<string, Date | null> {
    const completedAtByLesson = new Map(ctx.completions.map((c) => [c.lessonId, c.completedAt]));
    const acknowledgedAtByResource = new Map(
      ctx.acknowledgments.map((a) => [a.resourceId, a.acknowledgedAt]),
    );
    const submittedAtByTask = new Map(
      ctx.submissions
        .filter((s) => s.submittedAt !== null)
        .map((s) => [s.practicalTaskId, s.submittedAt as Date]),
    );

    const unlockDates = new Map<string, Date | null>();
    let previousSatisfiedAt: Date | null = ctx.enrollment.joinedAt ?? ctx.cohort.startsAt;

    for (const module of ctx.modules) {
      const unlockDate: Date | null = previousSatisfiedAt;
      unlockDates.set(module.id, unlockDate);

      if (!unlockDate) {
        previousSatisfiedAt = null;
        continue;
      }

      const requiredLessons = module.lessons.filter((l) => l.completionRequired);
      const requiredResources = module.resources.filter((r) => r.isRequired);
      const requiredTasks = module.requiresPracticalWork ? module.practicalTasks : [];
      const relevantDates = [
        ...requiredLessons.map((l) => completedAtByLesson.get(l.id) ?? null),
        ...requiredResources.map((r) => acknowledgedAtByResource.get(r.id) ?? null),
        ...requiredTasks.map((t) => submittedAtByTask.get(t.id) ?? null),
      ];

      if (relevantDates.length === 0) {
        previousSatisfiedAt = unlockDate;
      } else if (relevantDates.some((d) => d === null)) {
        previousSatisfiedAt = null;
      } else {
        previousSatisfiedAt = new Date(
          Math.max(...relevantDates.map((d) => (d as Date).getTime())),
        );
      }
    }

    return unlockDates;
  }

  computeTaskDueDate(
    unlockDates: Map<string, Date | null>,
    moduleId: string,
    task: Pick<CurriculumSnapshotTask, 'dueOffsetDays'>,
  ): Date | null {
    const unlockDate = unlockDates.get(moduleId);
    if (!unlockDate || task.dueOffsetDays === null) {
      return null;
    }
    return addDays(unlockDate, task.dueOffsetDays);
  }

  /** Convenience wrapper for the single-task case (the submit-action
   * endpoint) — finds the task's own module within the enrollment's active
   * track and computes its due date. */
  async computeDueDateForTask(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
    practicalTaskId: string,
  ): Promise<Date | null> {
    const ctx = await this.progressionService.buildContext(scope, enrollmentId, callerId);
    const module = ctx.modules.find((m) => m.practicalTasks.some((t) => t.id === practicalTaskId));
    if (!module) {
      return null;
    }
    const task = module.practicalTasks.find((t) => t.id === practicalTaskId)!;
    const unlockDates = this.computeFromContext(ctx);
    return this.computeTaskDueDate(unlockDates, module.id, task);
  }
}
