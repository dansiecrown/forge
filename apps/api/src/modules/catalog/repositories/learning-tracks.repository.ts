import { Injectable } from '@nestjs/common';
import type { CurriculumStatus, LearningTrack, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { reorderChildren } from '../../../shared/database/reorder-children';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListLearningTracksOptions {
  fellowshipId: string;
  status?: CurriculumStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class LearningTracksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListLearningTracksOptions,
  ): Promise<{ rows: LearningTrack[]; hasMore: boolean }> {
    const where: Prisma.LearningTrackWhereInput = {
      organizationId: scope.organizationId,
      fellowshipId: options.fellowshipId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.learningTrack.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<LearningTrack | null> {
    return this.prisma.learningTrack.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  findByIdIncludingArchived(scope: TenantScope, id: string): Promise<LearningTrack | null> {
    return this.prisma.learningTrack.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  findBySlug(
    scope: TenantScope,
    fellowshipId: string,
    slug: string,
  ): Promise<LearningTrack | null> {
    return this.prisma.learningTrack.findFirst({
      where: { organizationId: scope.organizationId, fellowshipId, slug, deletedAt: null },
    });
  }

  create(
    scope: TenantScope,
    data: {
      fellowshipId: string;
      name: string;
      slug: string;
      description?: string;
      iconMetadata?: Record<string, unknown>;
      difficulty?: string;
      estimatedWeeks?: number;
      displayOrder?: number;
      prerequisitesMetadata?: Record<string, unknown>;
      learningOutcomes?: string[];
      tags?: string[];
    },
  ): Promise<LearningTrack> {
    return this.prisma.learningTrack.create({
      data: {
        organizationId: scope.organizationId,
        ...data,
        iconMetadata: data.iconMetadata as Prisma.InputJsonValue,
        prerequisitesMetadata: data.prerequisitesMetadata as Prisma.InputJsonValue,
      } as Prisma.LearningTrackUncheckedCreateInput,
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.LearningTrackUpdateInput,
    expectedVersion: number,
  ): Promise<LearningTrack> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.learningTrack.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new LearningTrackVersionConflictError(current.version);
      }
      return tx.learningTrack.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  async updateStatus(
    id: string,
    status: CurriculumStatus,
    expectedVersion: number,
  ): Promise<LearningTrack> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.learningTrack.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new LearningTrackVersionConflictError(current.version);
      }
      return tx.learningTrack.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
    });
  }

  archive(id: string): Promise<LearningTrack> {
    return this.prisma.learningTrack.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  restore(id: string): Promise<LearningTrack> {
    return this.prisma.learningTrack.update({
      where: { id },
      data: { status: 'draft', deletedAt: null, version: { increment: 1 } },
    });
  }

  reorder(
    scope: TenantScope,
    fellowshipId: string,
    items: { id: string; displayOrder: number }[],
  ): Promise<void> {
    return reorderChildren(
      this.prisma.learningTrack,
      { organizationId: scope.organizationId, fellowshipId, deletedAt: null },
      items,
    );
  }
}

export class LearningTrackVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Learning track has been modified since it was last read.');
  }
}
