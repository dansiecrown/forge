import { Injectable } from '@nestjs/common';
import { UsersService } from '../../identity/services/users.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import type {
  StudentActivityItem,
  StudentDashboard,
  StudentLessonDetail,
  StudentModuleDetail,
  StudentModuleSummary,
  StudentResourceSummary,
  StudentTaskSummary,
} from '../entities/student-curriculum.entity';
import { ResourceBookmarksRepository } from '../repositories/resource-bookmarks.repository';
import { computeEstimatedMinutesLearned, computeStreakDays } from '../utils/learning-stats.util';
import { DeadlineService } from './deadline.service';
import {
  ProgressionService,
  summarizeProgress,
  type ProgressionContext,
} from './progression.service';

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

@Injectable()
export class StudentCurriculumService {
  constructor(
    private readonly progressionService: ProgressionService,
    private readonly deadlineService: DeadlineService,
    private readonly resourceBookmarksRepository: ResourceBookmarksRepository,
    private readonly usersService: UsersService,
  ) {}

  private async loadContext(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<ProgressionContext> {
    return this.progressionService.buildContext(scope, enrollmentId, callerId);
  }

  private assertUnlocked(ctx: ProgressionContext, moduleId: string): void {
    if (ctx.moduleLockStates.get(moduleId) === 'locked') {
      throw AppException.forbidden('This week is still locked.');
    }
  }

  async listWeeklyModules(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<StudentModuleSummary[]> {
    const ctx = await this.loadContext(scope, enrollmentId, callerId);
    const unlockDates = this.deadlineService.computeFromContext(ctx);
    return ctx.modules.map((module) => ({
      id: module.id,
      weekNumber: module.weekNumber,
      title: module.title,
      summary: module.summary,
      status: module.status,
      lockState: ctx.moduleLockStates.get(module.id) ?? 'locked',
      unlockDate: toIso(unlockDates.get(module.id) ?? null),
      requiresMentorHuddle: module.requiresMentorHuddle,
      requiresPracticalWork: module.requiresPracticalWork,
      lessonCount: module.lessons.length,
      resourceCount: module.resources.length,
      taskCount: module.practicalTasks.length,
    }));
  }

  async getWeeklyModuleDetail(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
    moduleId: string,
  ): Promise<StudentModuleDetail> {
    const ctx = await this.loadContext(scope, enrollmentId, callerId);
    const module = ctx.modules.find((m) => m.id === moduleId);
    if (!module) {
      throw AppException.notFound('Weekly module not found.');
    }
    this.assertUnlocked(ctx, moduleId);

    const unlockDates = this.deadlineService.computeFromContext(ctx);
    const bookmarkedResourceIds = new Set(
      (await this.resourceBookmarksRepository.listForEnrollment(enrollmentId)).map(
        (b) => b.resourceId,
      ),
    );
    const submissionByTaskId = new Map(ctx.submissions.map((s) => [s.practicalTaskId, s]));

    return {
      id: module.id,
      weekNumber: module.weekNumber,
      title: module.title,
      objectives: module.objectives,
      summary: module.summary,
      estimatedStudyHours: module.estimatedStudyHours,
      status: module.status,
      lockState: ctx.moduleLockStates.get(moduleId) ?? 'locked',
      unlockDate: toIso(unlockDates.get(moduleId) ?? null),
      requiresMentorHuddle: module.requiresMentorHuddle,
      huddleScheduleMetadata: module.huddleScheduleMetadata,
      huddleMeetingLink: module.huddleMeetingLink,
      mentorHuddleNotes: module.mentorHuddleNotes,
      huddleAttendanceRequired: module.huddleAttendanceRequired,
      requiresPracticalWork: module.requiresPracticalWork,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        lessonType: lesson.lessonType,
        estimatedDurationMinutes: lesson.estimatedDurationMinutes,
        completionRequired: lesson.completionRequired,
        completed: ctx.completedLessonIds.has(lesson.id),
        displayOrder: lesson.displayOrder,
      })),
      resources: module.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        resourceType: resource.resourceType,
        url: resource.url,
        author: resource.author,
        provider: resource.provider,
        estimatedDurationMinutes: resource.estimatedDurationMinutes,
        notes: resource.notes,
        isRequired: resource.isRequired,
        acknowledged: ctx.acknowledgedResourceIds.has(resource.id),
        bookmarked: bookmarkedResourceIds.has(resource.id),
        displayOrder: resource.displayOrder,
      })),
      practicalTasks: module.practicalTasks.map((task) => {
        const submission = submissionByTaskId.get(task.id);
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          dueOffsetDays: task.dueOffsetDays,
          dueDate: toIso(this.deadlineService.computeTaskDueDate(unlockDates, moduleId, task)),
          displayOrder: task.displayOrder,
          submission: submission
            ? {
                id: submission.id,
                status: submission.status,
                repositoryUrl: submission.repositoryUrl,
                liveDemoUrl: submission.liveDemoUrl,
                submittedAt: toIso(submission.submittedAt),
              }
            : null,
        };
      }),
    };
  }

  async getLessonDetail(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
    lessonId: string,
  ): Promise<StudentLessonDetail> {
    const ctx = await this.loadContext(scope, enrollmentId, callerId);
    const module = ctx.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
    if (!module) {
      throw AppException.notFound('Lesson not found.');
    }
    this.assertUnlocked(ctx, module.id);

    const index = module.lessons.findIndex((l) => l.id === lessonId);
    const lesson = module.lessons[index];

    return {
      id: lesson.id,
      moduleId: module.id,
      moduleTitle: module.title,
      weekNumber: module.weekNumber,
      title: lesson.title,
      description: lesson.description,
      lessonType: lesson.lessonType,
      estimatedDurationMinutes: lesson.estimatedDurationMinutes,
      resourceUrl: lesson.resourceUrl,
      attachmentMetadata: lesson.attachmentMetadata,
      embeddedContentMetadata: lesson.embeddedContentMetadata,
      completionRequired: lesson.completionRequired,
      completed: ctx.completedLessonIds.has(lessonId),
      previousLessonId: index > 0 ? module.lessons[index - 1].id : null,
      nextLessonId: index < module.lessons.length - 1 ? module.lessons[index + 1].id : null,
    };
  }

  async listLearningResources(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
    filters: { q?: string; resourceType?: string; moduleId?: string; bookmarked?: boolean },
  ): Promise<StudentResourceSummary[]> {
    const ctx = await this.loadContext(scope, enrollmentId, callerId);
    const bookmarkedResourceIds = new Set(
      (await this.resourceBookmarksRepository.listForEnrollment(enrollmentId)).map(
        (b) => b.resourceId,
      ),
    );

    const accessibleModules = ctx.modules.filter(
      (m) => ctx.moduleLockStates.get(m.id) !== 'locked',
    );
    const results: StudentResourceSummary[] = [];
    for (const module of accessibleModules) {
      if (filters.moduleId && module.id !== filters.moduleId) {
        continue;
      }
      for (const resource of module.resources) {
        if (filters.resourceType && resource.resourceType !== filters.resourceType) {
          continue;
        }
        if (filters.q && !resource.title.toLowerCase().includes(filters.q.toLowerCase())) {
          continue;
        }
        const bookmarked = bookmarkedResourceIds.has(resource.id);
        if (filters.bookmarked && !bookmarked) {
          continue;
        }
        results.push({
          id: resource.id,
          title: resource.title,
          resourceType: resource.resourceType,
          url: resource.url,
          author: resource.author,
          provider: resource.provider,
          estimatedDurationMinutes: resource.estimatedDurationMinutes,
          notes: resource.notes,
          isRequired: resource.isRequired,
          acknowledged: ctx.acknowledgedResourceIds.has(resource.id),
          bookmarked,
          displayOrder: resource.displayOrder,
          moduleId: module.id,
          moduleTitle: module.title,
          weekNumber: module.weekNumber,
        });
      }
    }
    return results;
  }

  async listPracticalTasks(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<StudentTaskSummary[]> {
    const ctx = await this.loadContext(scope, enrollmentId, callerId);
    const unlockDates = this.deadlineService.computeFromContext(ctx);
    const submissionByTaskId = new Map(ctx.submissions.map((s) => [s.practicalTaskId, s]));

    const accessibleModules = ctx.modules.filter(
      (m) => ctx.moduleLockStates.get(m.id) !== 'locked',
    );
    return accessibleModules.flatMap((module) =>
      module.practicalTasks.map((task) => {
        const submission = submissionByTaskId.get(task.id);
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          dueOffsetDays: task.dueOffsetDays,
          dueDate: toIso(this.deadlineService.computeTaskDueDate(unlockDates, module.id, task)),
          displayOrder: task.displayOrder,
          moduleId: module.id,
          moduleTitle: module.title,
          weekNumber: module.weekNumber,
          submission: submission
            ? {
                id: submission.id,
                status: submission.status,
                repositoryUrl: submission.repositoryUrl,
                liveDemoUrl: submission.liveDemoUrl,
                submittedAt: toIso(submission.submittedAt),
              }
            : null,
        };
      }),
    );
  }

  async getPracticalTaskDetail(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
    taskId: string,
  ): Promise<StudentTaskSummary> {
    const tasks = await this.listPracticalTasks(scope, enrollmentId, callerId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      throw AppException.notFound('Practical task not found.');
    }
    return task;
  }

  async getActivity(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
    limit: number,
  ): Promise<StudentActivityItem[]> {
    const ctx = await this.loadContext(scope, enrollmentId, callerId);
    return this.buildActivity(ctx).slice(0, limit);
  }

  private buildActivity(ctx: ProgressionContext): StudentActivityItem[] {
    const lessonById = new Map(
      ctx.modules.flatMap((m) => m.lessons.map((l) => [l.id, { ...l, moduleId: m.id }])),
    );
    const resourceById = new Map(
      ctx.modules.flatMap((m) => m.resources.map((r) => [r.id, { ...r, moduleId: m.id }])),
    );
    const taskById = new Map(
      ctx.modules.flatMap((m) => m.practicalTasks.map((t) => [t.id, { ...t, moduleId: m.id }])),
    );

    const items: StudentActivityItem[] = [
      ...ctx.completions.flatMap((c) => {
        const lesson = lessonById.get(c.lessonId);
        return lesson
          ? [
              {
                type: 'lesson' as const,
                id: c.lessonId,
                title: lesson.title,
                moduleId: lesson.moduleId,
                occurredAt: c.completedAt.toISOString(),
              },
            ]
          : [];
      }),
      ...ctx.acknowledgments.flatMap((a) => {
        const resource = resourceById.get(a.resourceId);
        return resource
          ? [
              {
                type: 'resource' as const,
                id: a.resourceId,
                title: resource.title,
                moduleId: resource.moduleId,
                occurredAt: a.acknowledgedAt.toISOString(),
              },
            ]
          : [];
      }),
      ...ctx.submissions
        .filter((s) => s.submittedAt !== null)
        .flatMap((s) => {
          const task = taskById.get(s.practicalTaskId);
          return task
            ? [
                {
                  type: 'task' as const,
                  id: s.practicalTaskId,
                  title: task.title,
                  moduleId: task.moduleId,
                  occurredAt: (s.submittedAt as Date).toISOString(),
                },
              ]
            : [];
        }),
    ];

    return items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async getDashboard(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<StudentDashboard> {
    const ctx = await this.loadContext(scope, enrollmentId, callerId);

    if (!ctx.track) {
      return {
        hasActiveTrack: false,
        progressPercent: 0,
        currentWeekNumber: null,
        currentModuleId: null,
        streakDays: 0,
        estimatedMinutesLearned: 0,
        estimatedCompletionDate: null,
        nextUp: null,
        upcomingDeadlines: [],
        recentActivity: [],
      };
    }

    const caller = await this.usersService.getById(callerId);
    const summary = summarizeProgress(ctx);
    const unlockDates = this.deadlineService.computeFromContext(ctx);

    const nextUpLesson = summary.currentModule?.lessons.find(
      (l) => l.completionRequired && !ctx.completedLessonIds.has(l.id),
    );

    const upcomingDeadlines = (summary.currentModule ? [summary.currentModule] : [])
      .flatMap((module) =>
        module.practicalTasks
          .filter((task) => !ctx.submittedTaskIds.has(task.id))
          .map((task) => ({
            taskId: task.id,
            title: task.title,
            moduleId: module.id,
            dueDate: this.deadlineService.computeTaskDueDate(unlockDates, module.id, task),
          })),
      )
      .filter((d): d is typeof d & { dueDate: Date } => d.dueDate !== null)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5)
      .map((d) => ({ ...d, dueDate: d.dueDate.toISOString() }));

    return {
      hasActiveTrack: true,
      progressPercent: summary.progressPercent,
      currentWeekNumber: summary.currentModule?.weekNumber ?? null,
      currentModuleId: summary.currentModule?.id ?? null,
      streakDays: computeStreakDays(ctx, caller.timezone),
      estimatedMinutesLearned: computeEstimatedMinutesLearned(
        ctx.modules,
        ctx.completedLessonIds,
        ctx.acknowledgedResourceIds,
      ),
      estimatedCompletionDate: toIso(ctx.cohort.endsAt),
      nextUp: nextUpLesson
        ? {
            lessonId: nextUpLesson.id,
            title: nextUpLesson.title,
            moduleId: summary.currentModule!.id,
          }
        : null,
      upcomingDeadlines,
      recentActivity: this.buildActivity(ctx).slice(0, 8),
    };
  }

  async listBookmarks(scope: TenantScope, enrollmentId: string, callerId: string) {
    await this.loadContext(scope, enrollmentId, callerId);
    const resources = await this.listLearningResources(scope, enrollmentId, callerId, {
      bookmarked: true,
    });
    return resources;
  }

  async addBookmark(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
    resourceId: string,
  ): Promise<void> {
    const ctx = await this.loadContext(scope, enrollmentId, callerId);
    const exists = ctx.modules.some((m) => m.resources.some((r) => r.id === resourceId));
    if (!exists) {
      throw AppException.notFound('Learning resource not found.');
    }
    await this.resourceBookmarksRepository.add(enrollmentId, resourceId);
  }

  async removeBookmark(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
    resourceId: string,
  ): Promise<void> {
    await this.loadContext(scope, enrollmentId, callerId);
    await this.resourceBookmarksRepository.remove(enrollmentId, resourceId);
  }
}
