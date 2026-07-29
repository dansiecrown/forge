import { Injectable } from '@nestjs/common';
import type { Course, CurriculumStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { reorderChildren } from '../../../shared/database/reorder-children';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListCoursesOptions {
  learningTrackId: string;
  status?: CurriculumStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListCoursesOptions,
  ): Promise<{ rows: Course[]; hasMore: boolean }> {
    const where: Prisma.CourseWhereInput = {
      organizationId: scope.organizationId,
      learningTrackId: options.learningTrackId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.course.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<Course | null> {
    return this.prisma.course.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  findByIdIncludingArchived(scope: TenantScope, id: string): Promise<Course | null> {
    return this.prisma.course.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  findBySlug(scope: TenantScope, learningTrackId: string, slug: string): Promise<Course | null> {
    return this.prisma.course.findFirst({
      where: { organizationId: scope.organizationId, learningTrackId, slug, deletedAt: null },
    });
  }

  create(
    scope: TenantScope,
    data: {
      learningTrackId: string;
      title: string;
      slug: string;
      overview?: string;
      objectives?: string[];
      completionCriteria?: string;
      estimatedHours?: number;
      displayOrder?: number;
    },
  ): Promise<Course> {
    return this.prisma.course.create({
      data: {
        organizationId: scope.organizationId,
        ...data,
      } as Prisma.CourseUncheckedCreateInput,
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.CourseUpdateInput,
    expectedVersion: number,
  ): Promise<Course> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.course.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new CourseVersionConflictError(current.version);
      }
      return tx.course.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  async updateStatus(
    id: string,
    status: CurriculumStatus,
    expectedVersion: number,
  ): Promise<Course> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.course.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new CourseVersionConflictError(current.version);
      }
      return tx.course.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
    });
  }

  archive(id: string): Promise<Course> {
    return this.prisma.course.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  restore(id: string): Promise<Course> {
    return this.prisma.course.update({
      where: { id },
      data: { status: 'draft', deletedAt: null, version: { increment: 1 } },
    });
  }

  reorder(
    scope: TenantScope,
    learningTrackId: string,
    items: { id: string; displayOrder: number }[],
  ): Promise<void> {
    return reorderChildren(
      this.prisma.course,
      { organizationId: scope.organizationId, learningTrackId, deletedAt: null },
      items,
    );
  }
}

export class CourseVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Course has been modified since it was last read.');
  }
}
