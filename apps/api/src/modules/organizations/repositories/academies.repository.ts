import { Injectable } from '@nestjs/common';
import type { Academy, AcademyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListAcademiesOptions {
  status?: AcademyStatus;
  q?: string;
  cursor?: string;
  limit: number;
  /** Milestone 7 hierarchy scoping: confines the list to a single Academy id
   * for callers whose membership is restricted to it (e.g. ACADEMY_ADMIN). */
  restrictToId?: string;
}

@Injectable()
export class AcademiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListAcademiesOptions,
  ): Promise<{ rows: Academy[]; hasMore: boolean }> {
    const where: Prisma.AcademyWhereInput = {
      organizationId: scope.organizationId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
      ...(options.restrictToId ? { id: options.restrictToId } : {}),
    };

    const rows = await this.prisma.academy.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<Academy | null> {
    return this.prisma.academy.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  /** Includes soft-deleted (archived) rows — used by the restore path, which
   * must be able to find what it's restoring. */
  findByIdIncludingArchived(scope: TenantScope, id: string): Promise<Academy | null> {
    return this.prisma.academy.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  findBySlug(scope: TenantScope, slug: string): Promise<Academy | null> {
    return this.prisma.academy.findFirst({
      where: { organizationId: scope.organizationId, slug, deletedAt: null },
    });
  }

  create(
    scope: TenantScope,
    data: {
      name: string;
      slug: string;
      timezone?: string;
      description?: string;
      contactEmail?: string;
      branding?: Record<string, unknown>;
      isPublic?: boolean;
    },
  ): Promise<Academy> {
    return this.prisma.academy.create({
      data: {
        organizationId: scope.organizationId,
        ...data,
        branding: data.branding as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.AcademyUpdateInput,
    expectedVersion: number,
  ): Promise<Academy> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.academy.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new AcademyVersionConflictError(current.version);
      }
      return tx.academy.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  archive(id: string): Promise<Academy> {
    return this.prisma.academy.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  restore(id: string): Promise<Academy> {
    return this.prisma.academy.update({
      where: { id },
      data: { status: 'active', deletedAt: null, version: { increment: 1 } },
    });
  }
}

export class AcademyVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Academy has been modified since it was last read.');
  }
}
