import { Injectable } from '@nestjs/common';
import { Prisma, type Enrollment, type EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListEnrollmentsOptions {
  cohortId?: string;
  status?: EnrollmentStatus;
  cursor?: string;
  limit: number;
}

/** Postgres unique_violation, per docs/database-design.md's documented
 * partial unique index enforcing "one active/pending enrollment per
 * fellowship" (hand-written in the migration SQL — see EnrollmentsRepository
 * doc comment). */
const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class EnrollmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListEnrollmentsOptions,
  ): Promise<{ rows: Enrollment[]; hasMore: boolean }> {
    const where: Prisma.EnrollmentWhereInput = {
      organizationId: scope.organizationId,
      ...(options.cohortId ? { cohortId: options.cohortId } : {}),
      ...(options.status ? { status: options.status } : {}),
    };

    const rows = await this.prisma.enrollment.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  /** Self-lookup for `GET /enrollments/me` — a Student discovering their own
   * enrollment(s) in the active organization, since STUDENT does not hold
   * the generic `enrollment.read` permission (by design, Milestone 4). */
  async findByUserId(
    scope: TenantScope,
    userId: string,
    options: { cursor?: string; limit: number },
  ): Promise<{ rows: Enrollment[]; hasMore: boolean }> {
    const rows = await this.prisma.enrollment.findMany({
      where: { organizationId: scope.organizationId, userId },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  countActiveForCohort(cohortId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { cohortId, status: { in: ['invited', 'active', 'paused'] } },
    });
  }

  /** Throws `EnrollmentConflictError` if the DB's partial unique index
   * rejects this insert — either a duplicate (cohort, user) row, or a second
   * active/pending enrollment for the same fellowship. */
  async create(
    scope: TenantScope,
    data: {
      academyId: string;
      fellowshipId: string;
      cohortId: string;
      userId: string;
    },
  ): Promise<Enrollment> {
    try {
      return await this.prisma.enrollment.create({
        data: { organizationId: scope.organizationId, ...data },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new EnrollmentConflictError();
      }
      throw error;
    }
  }

  /** Handles both a lifecycle status transition and/or a
   * `currentLearningTrackId` change in one PATCH — either field may be
   * omitted. */
  async update(
    id: string,
    data: { status?: EnrollmentStatus; currentLearningTrackId?: string },
    expectedVersion: number,
  ): Promise<Enrollment> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.enrollment.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new EnrollmentVersionConflictError(current.version);
      }
      return tx.enrollment.update({
        where: { id },
        data: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.currentLearningTrackId !== undefined
            ? { currentLearningTrackId: data.currentLearningTrackId }
            : {}),
          version: { increment: 1 },
          ...(data.status === 'active' && !current.joinedAt ? { joinedAt: new Date() } : {}),
          ...(data.status === 'completed' || data.status === 'withdrawn'
            ? { endedAt: new Date() }
            : {}),
        },
      });
    });
  }
}

export class EnrollmentVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Enrollment has been modified since it was last read.');
  }
}

export class EnrollmentConflictError extends Error {
  constructor() {
    super('This student already has an active or pending enrollment in this fellowship.');
  }
}
