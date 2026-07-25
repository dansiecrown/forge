import { Injectable } from '@nestjs/common';
import type { Fellowship, FellowshipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListFellowshipsOptions {
  academyId?: string;
  status?: FellowshipStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class FellowshipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListFellowshipsOptions,
  ): Promise<{ rows: Fellowship[]; hasMore: boolean }> {
    const where: Prisma.FellowshipWhereInput = {
      organizationId: scope.organizationId,
      deletedAt: null,
      ...(options.academyId ? { academyId: options.academyId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.fellowship.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<Fellowship | null> {
    return this.prisma.fellowship.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  findBySlug(scope: TenantScope, academyId: string, slug: string): Promise<Fellowship | null> {
    return this.prisma.fellowship.findFirst({
      where: { organizationId: scope.organizationId, academyId, slug, deletedAt: null },
    });
  }

  create(
    scope: TenantScope,
    data: {
      academyId: string;
      title: string;
      slug: string;
      durationWeeks: number;
      summary?: string;
      description?: string;
      defaultCapacity?: number;
      isPublic?: boolean;
      registrationOpensAt?: Date;
      registrationClosesAt?: Date;
      eligibilityMetadata?: Record<string, unknown>;
    },
  ): Promise<Fellowship> {
    return this.prisma.fellowship.create({
      data: {
        organizationId: scope.organizationId,
        ...data,
        eligibilityMetadata: data.eligibilityMetadata as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.FellowshipUpdateInput,
    expectedVersion: number,
  ): Promise<Fellowship> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.fellowship.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new FellowshipVersionConflictError(current.version);
      }
      return tx.fellowship.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  /** `retired` is a terminal lifecycle status, not a soft delete — `deletedAt`
   * is reserved for an actual delete path, which this milestone doesn't wire
   * up for Fellowship (no DELETE /fellowships/:id in docs/api-specification.md). */
  async updateStatus(
    id: string,
    status: FellowshipStatus,
    expectedVersion: number,
  ): Promise<Fellowship> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.fellowship.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new FellowshipVersionConflictError(current.version);
      }
      return tx.fellowship.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
    });
  }
}

export class FellowshipVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Fellowship has been modified since it was last read.');
  }
}
