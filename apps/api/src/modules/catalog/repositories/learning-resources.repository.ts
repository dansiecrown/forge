import { Injectable } from '@nestjs/common';
import type { CurriculumStatus, LearningResource, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { reorderChildren } from '../../../shared/database/reorder-children';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListLearningResourcesOptions {
  weeklyModuleId: string;
  status?: CurriculumStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class LearningResourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListLearningResourcesOptions,
  ): Promise<{ rows: LearningResource[]; hasMore: boolean }> {
    const where: Prisma.LearningResourceWhereInput = {
      organizationId: scope.organizationId,
      weeklyModuleId: options.weeklyModuleId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.learningResource.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<LearningResource | null> {
    return this.prisma.learningResource.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  findByIdIncludingArchived(scope: TenantScope, id: string): Promise<LearningResource | null> {
    return this.prisma.learningResource.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  create(
    scope: TenantScope,
    data: {
      weeklyModuleId: string;
      lessonId?: string;
      resourceType: string;
      url?: string;
      title: string;
      author?: string;
      provider?: string;
      estimatedDurationMinutes?: number;
      isRequired?: boolean;
      notes?: string;
      displayOrder?: number;
    },
  ): Promise<LearningResource> {
    return this.prisma.learningResource.create({
      data: {
        organizationId: scope.organizationId,
        ...data,
      } as Prisma.LearningResourceUncheckedCreateInput,
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.LearningResourceUpdateInput,
    expectedVersion: number,
  ): Promise<LearningResource> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.learningResource.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new LearningResourceVersionConflictError(current.version);
      }
      return tx.learningResource.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  async updateStatus(
    id: string,
    status: CurriculumStatus,
    expectedVersion: number,
  ): Promise<LearningResource> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.learningResource.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new LearningResourceVersionConflictError(current.version);
      }
      return tx.learningResource.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
    });
  }

  archive(id: string): Promise<LearningResource> {
    return this.prisma.learningResource.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  restore(id: string): Promise<LearningResource> {
    return this.prisma.learningResource.update({
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
      this.prisma.learningResource,
      { organizationId: scope.organizationId, weeklyModuleId, deletedAt: null },
      items,
    );
  }
}

export class LearningResourceVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Learning resource has been modified since it was last read.');
  }
}
