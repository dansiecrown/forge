import { Injectable } from '@nestjs/common';
import type {
  LessonCompletion,
  PracticalTaskSubmission,
  ResourceAcknowledgment,
} from '@prisma/client';
import type {
  CurriculumSnapshot,
  CurriculumSnapshotModule,
  CurriculumSnapshotTrack,
} from '../../catalog/services/curriculum-snapshot.service';
import { LessonsService } from '../../catalog/services/lessons.service';
import { LearningResourcesService } from '../../catalog/services/learning-resources.service';
import { PracticalTasksService } from '../../catalog/services/practical-tasks.service';
import { FellowshipTrackMentorsService } from '../../catalog/services/fellowship-track-mentors.service';
import type { CohortEntity } from '../../cohorts/entities/cohort.entity';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import type { ProgressSummaryEntity } from '../entities/progress-summary.entity';
import { LessonCompletionsRepository } from '../repositories/lesson-completions.repository';
import { PracticalTaskSubmissionsRepository } from '../repositories/practical-task-submissions.repository';
import { ResourceAcknowledgmentsRepository } from '../repositories/resource-acknowledgments.repository';
import { assertOwnEnrollment } from '../support/enrollment-ownership';
import { assertMentorCanAccessEnrollment } from '../support/mentor-cohort-scope';

export function flattenModules(track: CurriculumSnapshotTrack): CurriculumSnapshotModule[] {
  return track.courses.flatMap((course) => course.weeklyModules);
}

export interface ProgressSummary {
  currentModule: CurriculumSnapshotModule | undefined;
  completedModuleIds: string[];
  lockedModuleIds: string[];
  progressPercent: number;
}

/** Pure summarizer shared by `getProgress` and the dashboard endpoint — both
 * need the same current-module/completed/locked/percent computation from an
 * already-built `ProgressionContext`. Requires `ctx.track` to be non-null. */
export function summarizeProgress(ctx: ProgressionContext): ProgressSummary {
  const currentModule = ctx.modules.find((m) => ctx.moduleLockStates.get(m.id) === 'current');
  const completedModuleIds = ctx.modules
    .filter((m) => ctx.moduleLockStates.get(m.id) === 'completed')
    .map((m) => m.id);
  const lockedModuleIds = ctx.modules
    .filter((m) => ctx.moduleLockStates.get(m.id) === 'locked')
    .map((m) => m.id);

  const totalRequiredLessons = ctx.modules.flatMap((m) =>
    m.lessons.filter((l) => l.completionRequired),
  );
  const progressPercent =
    totalRequiredLessons.length === 0
      ? 0
      : Math.round(
          (totalRequiredLessons.filter((l) => ctx.completedLessonIds.has(l.id)).length /
            totalRequiredLessons.length) *
            100,
        );

  return { currentModule, completedModuleIds, lockedModuleIds, progressPercent };
}

export type ModuleLockState = 'completed' | 'current' | 'locked';

/** Everything the progression engine, deadline computation, and
 * student-curriculum browsing endpoints all need — loaded once per request
 * and shared, rather than each re-walking the snapshot and re-querying the
 * three progression tables independently. */
export interface ProgressionContext {
  enrollment: EnrollmentEntity;
  cohort: CohortEntity;
  track: CurriculumSnapshotTrack | null;
  /** Flattened, in curriculum order. Empty if there is no active track. */
  modules: CurriculumSnapshotModule[];
  /** Same order as `modules`. */
  moduleLockStates: Map<string, ModuleLockState>;
  completions: LessonCompletion[];
  acknowledgments: ResourceAcknowledgment[];
  /** All rows, including drafts — filter on `submittedAt !== null` to get
   * "actually submitted" tasks (a draft row has `submittedAt: null`). */
  submissions: PracticalTaskSubmission[];
  completedLessonIds: Set<string>;
  acknowledgedResourceIds: Set<string>;
  submittedTaskIds: Set<string>;
}

@Injectable()
export class ProgressionService {
  constructor(
    private readonly lessonCompletionsRepository: LessonCompletionsRepository,
    private readonly resourceAcknowledgmentsRepository: ResourceAcknowledgmentsRepository,
    private readonly practicalTaskSubmissionsRepository: PracticalTaskSubmissionsRepository,
    private readonly cohortsService: CohortsService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly lessonsService: LessonsService,
    private readonly learningResourcesService: LearningResourcesService,
    private readonly practicalTasksService: PracticalTasksService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly membershipsService: MembershipsService,
    private readonly auditLog: AuditLogService,
    private readonly fellowshipTrackMentorsService: FellowshipTrackMentorsService,
  ) {}

  async completeLesson(
    scope: TenantScope,
    lessonId: string,
    enrollmentId: string,
    callerId: string,
  ): Promise<void> {
    await this.lessonsService.assertBelongsToScope(scope, lessonId);
    await assertOwnEnrollment(this.enrollmentsService, scope, enrollmentId, callerId);
    await this.lessonCompletionsRepository.recordCompletion(enrollmentId, lessonId);
    await this.auditLog.record({
      action: 'lesson.completed',
      entityType: 'lesson',
      entityId: lessonId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
      metadata: { enrollmentId },
    });
  }

  async acknowledgeResource(
    scope: TenantScope,
    resourceId: string,
    enrollmentId: string,
    callerId: string,
  ): Promise<void> {
    await this.learningResourcesService.assertBelongsToScope(scope, resourceId);
    await assertOwnEnrollment(this.enrollmentsService, scope, enrollmentId, callerId);
    await this.resourceAcknowledgmentsRepository.recordAcknowledgment(enrollmentId, resourceId);
    await this.auditLog.record({
      action: 'learning_resource.acknowledged',
      entityType: 'learning_resource',
      entityId: resourceId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
      metadata: { enrollmentId },
    });
  }

  /** Saves (or overwrites) a task's draft submission content. Editing an
   * already-`submitted` row is allowed here too — it silently reverts the
   * row to `draft` (see `PracticalTaskSubmissionsRepository.saveDraft`); the
   * caller must explicitly call `submitTask` again. */
  async saveTaskSubmissionDraft(
    scope: TenantScope,
    practicalTaskId: string,
    enrollmentId: string,
    callerId: string,
    data: { repositoryUrl?: string; liveDemoUrl?: string },
  ): Promise<void> {
    await this.practicalTasksService.assertBelongsToScope(scope, practicalTaskId);
    await assertOwnEnrollment(this.enrollmentsService, scope, enrollmentId, callerId);
    await this.practicalTaskSubmissionsRepository.saveDraft(enrollmentId, practicalTaskId, data);
    await this.auditLog.record({
      action: 'practical_task.draft_saved',
      entityType: 'practical_task',
      entityId: practicalTaskId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
      metadata: { enrollmentId },
    });
  }

  /** A first-time submission is never deadline-blocked. Re-submitting after
   * an edit (which reverted the row to `draft`) is blocked once the task's
   * computed due date has passed — see DeadlineService and
   * docs/adr/0007-student-experience.md. */
  async submitTask(
    scope: TenantScope,
    practicalTaskId: string,
    enrollmentId: string,
    callerId: string,
    dueDate: Date | null,
  ): Promise<void> {
    const task = await this.practicalTasksService.assertBelongsToScope(scope, practicalTaskId);
    await assertOwnEnrollment(this.enrollmentsService, scope, enrollmentId, callerId);

    const existing = await this.practicalTaskSubmissionsRepository.findOne(
      enrollmentId,
      practicalTaskId,
    );
    if (!existing) {
      throw AppException.validation([
        {
          field: 'practicalTaskId',
          code: 'NO_DRAFT_SAVED',
          message: 'Save a draft with your repository or demo URL before submitting.',
        },
      ]);
    }
    const isResubmission = existing.submittedAt !== null || existing.status !== 'draft';
    if (isResubmission && dueDate && new Date() > dueDate) {
      throw AppException.conflict(
        'SUBMISSION_WINDOW_CLOSED',
        `The submission window for "${task.title}" has closed.`,
      );
    }

    await this.practicalTaskSubmissionsRepository.submit(enrollmentId, practicalTaskId);
    await this.auditLog.record({
      action: 'practical_task.submitted',
      entityType: 'practical_task',
      entityId: practicalTaskId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
      metadata: { enrollmentId },
    });
  }

  /** Self-or-staff authorization shared by every read in this service — the
   * learner themselves, a caller holding the broader `enrollment.manage`
   * permission (Org Admin/Academy Admin), or a Mentor actively assigned to
   * this enrollment's cohort. Tightened in Milestone 6 from a bare
   * self-or-org-wide-`enrollment.read` check: `enrollment.read` alone is
   * held by every Mentor organization-wide, so it could never have enforced
   * "mentors only see assigned cohorts" (docs/development-roadmap.md Phase
   * 8) — see docs/adr/0008-mentor-experience.md Decision 3 and
   * docs/KNOWN_TECHNICAL_DEBT.md DEBT-015. This is a genuine behavior change
   * to existing Milestone 4/5 reads, not purely additive: every endpoint
   * that flows through `buildContext`/`getProgress` is now correctly
   * cohort-scoped for mentors. */
  private async assertCanRead(
    scope: TenantScope,
    enrollment: EnrollmentEntity,
    callerId: string,
  ): Promise<void> {
    await assertMentorCanAccessEnrollment(
      this.cohortsService,
      this.membershipsService,
      this.permissionResolver,
      this.fellowshipTrackMentorsService,
      scope,
      callerId,
      enrollment,
    );
  }

  /** Loads and evaluates everything the progression engine, deadline
   * computation, and student-curriculum browsing endpoints need — the
   * enrollment's cohort's frozen `curriculumSnapshot` (never live catalog
   * tables, see docs/adr/0006-curriculum-learning-engine.md), flattened into
   * modules in order, each evaluated against the caller's completion/
   * acknowledgment/submission rows using the fixed gate rule: all
   * `completionRequired` lessons done, all `isRequired` resources
   * acknowledged, and — when `requiresPracticalWork` — all practical tasks
   * actually submitted (`submittedAt !== null`; a saved-but-unsubmitted
   * draft does not satisfy the gate). */
  async buildContext(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<ProgressionContext> {
    const enrollment = await this.enrollmentsService.get(scope, enrollmentId);
    await this.assertCanRead(scope, enrollment, callerId);
    const cohort = await this.cohortsService.get(scope, enrollment.cohortId, callerId);

    const snapshot = cohort.curriculumSnapshot as CurriculumSnapshot | null;
    const track = snapshot?.tracks.find((t) => t.id === enrollment.currentLearningTrackId) ?? null;

    if (!track) {
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
      };
    }

    const modules = flattenModules(track);
    const [completions, acknowledgments, submissions] = await Promise.all([
      this.lessonCompletionsRepository.listForEnrollment(enrollmentId),
      this.resourceAcknowledgmentsRepository.listForEnrollment(enrollmentId),
      this.practicalTaskSubmissionsRepository.listForEnrollment(enrollmentId),
    ]);
    const completedLessonIds = new Set(completions.map((c) => c.lessonId));
    const acknowledgedResourceIds = new Set(acknowledgments.map((a) => a.resourceId));
    const submittedTaskIds = new Set(
      submissions.filter((s) => s.submittedAt !== null).map((s) => s.practicalTaskId),
    );

    const isModuleSatisfied = (module: CurriculumSnapshotModule): boolean => {
      const requiredLessons = module.lessons.filter((l) => l.completionRequired);
      const requiredResources = module.resources.filter((r) => r.isRequired);
      const requiredTasks = module.requiresPracticalWork ? module.practicalTasks : [];
      return (
        requiredLessons.every((l) => completedLessonIds.has(l.id)) &&
        requiredResources.every((r) => acknowledgedResourceIds.has(r.id)) &&
        requiredTasks.every((t) => submittedTaskIds.has(t.id))
      );
    };

    let currentIndex = modules.findIndex((module) => !isModuleSatisfied(module));
    if (currentIndex === -1) {
      currentIndex = modules.length > 0 ? modules.length - 1 : -1;
    }

    const moduleLockStates = new Map<string, ModuleLockState>();
    modules.forEach((module, index) => {
      if (currentIndex < 0) {
        moduleLockStates.set(module.id, 'locked');
      } else if (index < currentIndex) {
        moduleLockStates.set(module.id, 'completed');
      } else if (index === currentIndex) {
        moduleLockStates.set(module.id, 'current');
      } else {
        moduleLockStates.set(module.id, 'locked');
      }
    });

    return {
      enrollment,
      cohort,
      track,
      modules,
      moduleLockStates,
      completions,
      acknowledgments,
      submissions,
      completedLessonIds,
      acknowledgedResourceIds,
      submittedTaskIds,
    };
  }

  async getProgress(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<ProgressSummaryEntity> {
    const ctx = await this.buildContext(scope, enrollmentId, callerId);

    if (!ctx.track) {
      return {
        enrollmentId,
        hasActiveTrack: false,
        learningTrackId: ctx.enrollment.currentLearningTrackId,
        progressPercent: 0,
        currentWeekNumber: null,
        currentModuleId: null,
        lockedModuleIds: [],
        completedModuleIds: [],
        estimatedCompletionDate: ctx.enrollment.currentLearningTrackId ? ctx.cohort.endsAt : null,
      };
    }

    const summary = summarizeProgress(ctx);

    return {
      enrollmentId,
      hasActiveTrack: true,
      learningTrackId: ctx.track.id,
      progressPercent: summary.progressPercent,
      currentWeekNumber: summary.currentModule?.weekNumber ?? null,
      currentModuleId: summary.currentModule?.id ?? null,
      lockedModuleIds: summary.lockedModuleIds,
      completedModuleIds: summary.completedModuleIds,
      estimatedCompletionDate: ctx.cohort.endsAt,
    };
  }
}
