import { Injectable } from '@nestjs/common';
import type { CurriculumStatus, PracticalTask, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { reorderChildren } from '../../../shared/database/reorder-children';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListPracticalTasksOptions {
  weeklyModuleId: string;
  status?: CurriculumStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class PracticalTasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListPracticalTasksOptions,
  ): Promise<{ rows: PracticalTask[]; hasMore: boolean }> {
    const where: Prisma.PracticalTaskWhereInput = {
      organizationId: scope.organizationId,
      weeklyModuleId: options.weeklyModuleId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.practicalTask.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<PracticalTask | null> {
    return this.prisma.practicalTask.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  findByIdIncludingArchived(scope: TenantScope, id: string): Promise<PracticalTask | null> {
    return this.prisma.practicalTask.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  create(
    scope: TenantScope,
    data: {
      weeklyModuleId: string;
      title: string;
      description?: string;
      instructions?: string;
      deliverables?: string[];
      submissionTypeMetadata?: Record<string, unknown>;
      dueOffsetDays?: number;
      rubricMetadata?: Record<string, unknown>;
      maxScore?: number;
      displayOrder?: number;
    },
  ): Promise<PracticalTask> {
    return this.prisma.practicalTask.create({
      data: {
        organizationId: scope.organizationId,
        ...data,
        submissionTypeMetadata: data.submissionTypeMetadata as Prisma.InputJsonValue,
        rubricMetadata: data.rubricMetadata as Prisma.InputJsonValue,
      } as Prisma.PracticalTaskUncheckedCreateInput,
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.PracticalTaskUpdateInput,
    expectedVersion: number,
  ): Promise<PracticalTask> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.practicalTask.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new PracticalTaskVersionConflictError(current.version);
      }
      return tx.practicalTask.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  async updateStatus(
    id: string,
    status: CurriculumStatus,
    expectedVersion: number,
  ): Promise<PracticalTask> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.practicalTask.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new PracticalTaskVersionConflictError(current.version);
      }
      return tx.practicalTask.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
    });
  }

  archive(id: string): Promise<PracticalTask> {
    return this.prisma.practicalTask.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  restore(id: string): Promise<PracticalTask> {
    return this.prisma.practicalTask.update({
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
      this.prisma.practicalTask,
      { organizationId: scope.organizationId, weeklyModuleId, deletedAt: null },
      items,
    );
  }
}

export class PracticalTaskVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Practical task has been modified since it was last read.');
  }
}
