import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toCourseEntity, type CourseEntity } from '../entities/course.entity';
import type { CreateCourseDto, UpdateCourseDto } from '../dtos/course.dto';
import { CoursesRepository, CourseVersionConflictError } from '../repositories/courses.repository';
import { LearningTracksService } from './learning-tracks.service';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
};

@Injectable()
export class CoursesService {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly learningTracksService: LearningTracksService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    learningTrackId: string,
    options: { status?: string; q?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<CourseEntity>> {
    await this.learningTracksService.assertBelongsToScope(scope, learningTrackId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.coursesRepository.list(scope, {
      learningTrackId,
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toCourseEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<CourseEntity> {
    const course = await this.coursesRepository.findById(scope, id);
    if (!course) {
      throw AppException.notFound('Course not found.');
    }
    return toCourseEntity(course);
  }

  /** Existence + org-scope check for the `weekly-modules` service. */
  assertBelongsToScope(scope: TenantScope, courseId: string): Promise<CourseEntity> {
    return this.get(scope, courseId);
  }

  async create(
    scope: TenantScope,
    learningTrackId: string,
    input: CreateCourseDto,
    actorUserId?: string,
  ): Promise<CourseEntity> {
    await this.learningTracksService.assertBelongsToScope(scope, learningTrackId);

    const existing = await this.coursesRepository.findBySlug(scope, learningTrackId, input.slug);
    if (existing) {
      throw AppException.conflict(
        'SLUG_TAKEN',
        'This course slug is already in use in this learning track.',
      );
    }

    const course = await this.coursesRepository.create(scope, {
      learningTrackId,
      title: input.title,
      slug: input.slug,
      overview: input.overview,
      objectives: input.objectives,
      completionCriteria: input.completionCriteria,
      estimatedHours: input.estimatedHours,
    });

    await this.auditLog.record({
      action: 'course.created',
      entityType: 'course',
      entityId: course.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toCourseEntity(course);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateCourseDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CourseEntity> {
    await this.get(scope, id);
    try {
      const updated = await this.coursesRepository.update(scope, id, { ...input }, expectedVersion);
      await this.auditLog.record({
        action: 'course.updated',
        entityType: 'course',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toCourseEntity(updated);
    } catch (error) {
      if (error instanceof CourseVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Course has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  private async transition(
    scope: TenantScope,
    id: string,
    nextStatus: 'published' | 'archived',
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CourseEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Course cannot move from ${existing.status} to ${nextStatus}.`,
      );
    }
    try {
      const updated = await this.coursesRepository.updateStatus(id, nextStatus, expectedVersion);
      await this.auditLog.record({
        action: `course.${nextStatus}`,
        entityType: 'course',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toCourseEntity(updated);
    } catch (error) {
      if (error instanceof CourseVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Course has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  publish(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CourseEntity> {
    return this.transition(scope, id, 'published', expectedVersion, actorUserId);
  }

  archive(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CourseEntity> {
    return this.transition(scope, id, 'archived', expectedVersion, actorUserId);
  }

  async restore(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CourseEntity> {
    const course = await this.coursesRepository.findByIdIncludingArchived(scope, id);
    if (!course) {
      throw AppException.notFound('Course not found.');
    }
    if (course.version !== expectedVersion) {
      throw AppException.conflict(
        'VERSION_CONFLICT',
        `Course has moved to version ${course.version}.`,
      );
    }
    const updated = await this.coursesRepository.restore(id);
    await this.auditLog.record({
      action: 'course.restored',
      entityType: 'course',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toCourseEntity(updated);
  }

  async reorder(
    scope: TenantScope,
    learningTrackId: string,
    items: { id: string; displayOrder: number }[],
    actorUserId?: string,
  ): Promise<void> {
    await this.learningTracksService.assertBelongsToScope(scope, learningTrackId);
    await this.coursesRepository.reorder(scope, learningTrackId, items);
    await this.auditLog.record({
      action: 'course.reordered',
      entityType: 'learning_track',
      entityId: learningTrackId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { items },
    });
  }
}
