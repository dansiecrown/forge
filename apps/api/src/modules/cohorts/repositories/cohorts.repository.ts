import { Injectable } from '@nestjs/common';
import type { Cohort, CohortMentor, CohortStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListCohortsOptions {
  fellowshipId?: string;
  academyId?: string;
  status?: CohortStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class CohortsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListCohortsOptions,
  ): Promise<{ rows: Cohort[]; hasMore: boolean }> {
    const where: Prisma.CohortWhereInput = {
      organizationId: scope.organizationId,
      deletedAt: null,
      ...(options.fellowshipId ? { fellowshipId: options.fellowshipId } : {}),
      ...(options.academyId ? { academyId: options.academyId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.cohort.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { startsAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<Cohort | null> {
    return this.prisma.cohort.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  findBySlug(scope: TenantScope, academyId: string, slug: string): Promise<Cohort | null> {
    return this.prisma.cohort.findFirst({
      where: { organizationId: scope.organizationId, academyId, slug, deletedAt: null },
    });
  }

  create(
    scope: TenantScope,
    data: {
      academyId: string;
      fellowshipId: string;
      name: string;
      slug: string;
      startsAt: Date;
      endsAt: Date;
      timezone: string;
      capacity: number;
      description?: string;
      enrollmentDeadline?: Date;
    },
  ): Promise<Cohort> {
    return this.prisma.cohort.create({
      data: { organizationId: scope.organizationId, ...data },
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.CohortUpdateInput,
    expectedVersion: number,
  ): Promise<Cohort> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.cohort.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new CohortVersionConflictError(current.version);
      }
      return tx.cohort.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  updateStatus(id: string, status: CohortStatus): Promise<Cohort> {
    return this.prisma.cohort.update({
      where: { id },
      data: { status, version: { increment: 1 } },
    });
  }

  countActiveEnrollments(cohortId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { cohortId, status: { in: ['invited', 'active', 'paused'] } },
    });
  }

  // --- Mentor assignment -----------------------------------------------

  listMentors(cohortId: string): Promise<CohortMentor[]> {
    return this.prisma.cohortMentor.findMany({
      where: { cohortId, unassignedAt: null },
      orderBy: { assignedAt: 'asc' },
    });
  }

  findActiveMentorAssignment(cohortId: string, membershipId: string): Promise<CohortMentor | null> {
    return this.prisma.cohortMentor.findFirst({
      where: { cohortId, membershipId, unassignedAt: null },
    });
  }

  assignMentor(cohortId: string, membershipId: string): Promise<CohortMentor> {
    return this.prisma.cohortMentor.create({ data: { cohortId, membershipId } });
  }

  async unassignMentor(cohortId: string, membershipId: string): Promise<{ count: number }> {
    return this.prisma.cohortMentor.updateMany({
      where: { cohortId, membershipId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });
  }
}

export class CohortVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Cohort has been modified since it was last read.');
  }
}
