import { Injectable } from '@nestjs/common';
import type { CurriculumStatus, Lesson, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { reorderChildren } from '../../../shared/database/reorder-children';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListLessonsOptions {
  weeklyModuleId: string;
  status?: CurriculumStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class LessonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListLessonsOptions,
  ): Promise<{ rows: Lesson[]; hasMore: boolean }> {
    const where: Prisma.LessonWhereInput = {
      organizationId: scope.organizationId,
      weeklyModuleId: options.weeklyModuleId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.lesson.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<Lesson | null> {
    return this.prisma.lesson.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  findByIdIncludingArchived(scope: TenantScope, id: string): Promise<Lesson | null> {
    return this.prisma.lesson.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  create(
    scope: TenantScope,
    data: {
      weeklyModuleId: string;
      title: string;
      description?: string;
      lessonType: string;
      estimatedDurationMinutes?: number;
      resourceUrl?: string;
      attachmentMetadata?: Record<string, unknown>;
      embeddedContentMetadata?: Record<string, unknown>;
      completionRequired?: boolean;
      displayOrder?: number;
    },
  ): Promise<Lesson> {
    return this.prisma.lesson.create({
      data: {
        organizationId: scope.organizationId,
        ...data,
        attachmentMetadata: data.attachmentMetadata as Prisma.InputJsonValue,
        embeddedContentMetadata: data.embeddedContentMetadata as Prisma.InputJsonValue,
      } as Prisma.LessonUncheckedCreateInput,
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.LessonUpdateInput,
    expectedVersion: number,
  ): Promise<Lesson> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.lesson.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new LessonVersionConflictError(current.version);
      }
      return tx.lesson.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  async updateStatus(
    id: string,
    status: CurriculumStatus,
    expectedVersion: number,
  ): Promise<Lesson> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.lesson.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new LessonVersionConflictError(current.version);
      }
      return tx.lesson.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
    });
  }

  archive(id: string): Promise<Lesson> {
    return this.prisma.lesson.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  restore(id: string): Promise<Lesson> {
    return this.prisma.lesson.update({
      where: { id },
      data: { status: 'draft', deletedAt: null, version: { increment: 1 } },
    });
  }

  reorder(
    scope: TenantScope,
    weeklyModuleId: string,
    items: { id: string; displayOrder: number }[],
  ): Promise<void> {
    return reorderChildren(
      this.prisma.lesson,
      { organizationId: scope.organizationId, weeklyModuleId, deletedAt: null },
      items,
    );
  }
}

export class LessonVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Lesson has been modified since it was last read.');
  }
}
