import { Injectable } from '@nestjs/common';
import type { Cohort, CohortMentor, CohortStatus, Membership, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export type CohortMentorWithUser = CohortMentor & { membership: Membership & { user: User } };

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
      curriculumSnapshot?: Prisma.InputJsonValue;
      curriculumSnapshotAt?: Date;
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

  /** Regenerates a cohort's frozen curriculum read-model — the version
   * check happens in the service (mirrors `updateStatus`'s pattern, whose
   * caller (`transition`) also checks version before calling). */
  updateCurriculumSnapshot(id: string, snapshot: Prisma.InputJsonValue): Promise<Cohort> {
    return this.prisma.cohort.update({
      where: { id },
      data: {
        curriculumSnapshot: snapshot,
        curriculumSnapshotAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  countActiveEnrollments(cohortId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { cohortId, status: { in: ['invited', 'active', 'paused'] } },
    });
  }

  // --- Mentor assignment -----------------------------------------------

  /** Includes the membership's user — a mentor assignment must show a name,
   * never a bare membership id (docs/adr/0015-name-first-display.md). */
  listMentors(cohortId: string): Promise<CohortMentorWithUser[]> {
    return this.prisma.cohortMentor.findMany({
      where: { cohortId, unassignedAt: null },
      include: { membership: { include: { user: true } } },
      orderBy: { assignedAt: 'asc' },
    });
  }

  findActiveMentorAssignment(cohortId: string, membershipId: string): Promise<CohortMentor | null> {
    return this.prisma.cohortMentor.findFirst({
      where: { cohortId, membershipId, unassignedAt: null },
    });
  }

  /** Reverse lookup of `findActiveMentorAssignment` — "which cohorts is this
   * mentor assigned to," needed by the Mentor Portal's own cohort list and
   * every mentor-cohort-scope check below. */
  async listActiveForMentor(membershipId: string): Promise<Cohort[]> {
    const assignments = await this.prisma.cohortMentor.findMany({
      where: { membershipId, unassignedAt: null },
      include: { cohort: true },
      orderBy: { assignedAt: 'asc' },
    });
    return assignments.map((a) => a.cohort).filter((c) => c.deletedAt === null);
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

  // --- Track offerings (docs/adr/0016-cohort-scoped-tracks.md) -----------

  /** The Mentor Portal's "my cohorts" list needs this for a Fellowship-wide
   * track mentor — cohorts they have no `CohortMentor` row for at all, but
   * reachable through one of their track assignments. Matches on *either*
   * signal: the cohort's own explicit "offered tracks" declaration, or a
   * real Enrollment already on that track — the two are independent
   * (nothing constrains `Enrollment.currentLearningTrackId` to a track the
   * cohort has explicitly opted into; it predates this feature), and a
   * mentor must be able to discover a cohort with their track's actual
   * students even if nobody remembered to also register the offering. See
   * docs/adr/0016-cohort-scoped-tracks.md Decision 3. `organizationId` is
   * defense-in-depth, not the only thing preventing cross-tenant leakage
   * here — a track assignment can only ever be created within the
   * assignee's own organization in the first place. */
  listOfferingAnyTrack(organizationId: string, learningTrackIds: string[]): Promise<Cohort[]> {
    if (learningTrackIds.length === 0) return Promise.resolve([]);
    return this.prisma.cohort.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { offeredTracks: { some: { learningTrackId: { in: learningTrackIds } } } },
          { enrollments: { some: { currentLearningTrackId: { in: learningTrackIds } } } },
        ],
      },
    });
  }

  listOfferedTrackIds(cohortId: string): Promise<string[]> {
    return this.prisma.cohortLearningTrack
      .findMany({ where: { cohortId }, select: { learningTrackId: true } })
      .then((rows) => rows.map((row) => row.learningTrackId));
  }

  /** Replace-all semantics — the caller (`CohortsService.setOfferedTracks`)
   * has already validated every id belongs to this cohort's own Fellowship.
   * A transaction keeps "clear, then re-add" atomic so a failed request
   * never leaves a cohort with zero offered tracks by accident. */
  setOfferedTracks(cohortId: string, learningTrackIds: string[]): Promise<void> {
    return this.prisma
      .$transaction([
        this.prisma.cohortLearningTrack.deleteMany({ where: { cohortId } }),
        this.prisma.cohortLearningTrack.createMany({
          data: learningTrackIds.map((learningTrackId) => ({ cohortId, learningTrackId })),
        }),
      ])
      .then(() => undefined);
  }
}

export class CohortVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Cohort has been modified since it was last read.');
  }
}
