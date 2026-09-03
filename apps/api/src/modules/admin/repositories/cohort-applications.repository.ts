import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Academy,
  type CohortApplication,
  type CohortApplicationStatus,
  type Cohort,
  type Fellowship,
  type LearningTrack,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

/** Postgres unique_violation, per the two hand-written partial indexes on
 * `cohort_applications` (one pending application per cohort per prospect
 * email / applicant user) — see the migration SQL doc comment. */
const UNIQUE_VIOLATION = 'P2002';

export interface ListCohortApplicationsOptions {
  status?: CohortApplicationStatus;
  /** Confines the list to a single Academy id — set only for a restricted
   * caller (e.g. ACADEMY_ADMIN), same convention as every other admin list
   * built on `MembershipsService.getAcademyScope()`. */
  restrictToAcademyId?: string;
  applicantUserId?: string;
  cursor?: string;
  limit: number;
}

export interface CreateCohortApplicationData {
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  cohortId: string;
  applicantUserId?: string;
  prospectEmail?: string;
  prospectDisplayName?: string;
  requestedLearningTrackId?: string;
  note?: string;
}

export interface ApplyableCohort {
  cohort: Cohort;
  fellowship: Fellowship;
  academy: Academy;
}

@Injectable()
export class CohortApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListCohortApplicationsOptions,
  ): Promise<{ rows: CohortApplication[]; hasMore: boolean }> {
    const where: Prisma.CohortApplicationWhereInput = {
      organizationId: scope.organizationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.restrictToAcademyId ? { academyId: options.restrictToAcademyId } : {}),
      ...(options.applicantUserId ? { applicantUserId: options.applicantUserId } : {}),
    };

    const rows = await this.prisma.cohortApplication.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<CohortApplication | null> {
    return this.prisma.cohortApplication.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  /** Throws `CohortApplicationConflictError` if either hand-written partial
   * unique index rejects this insert — a pending application already exists
   * for this (cohort, prospect email) or (cohort, applicant user) pair. */
  async create(data: CreateCohortApplicationData): Promise<CohortApplication> {
    try {
      return await this.prisma.cohortApplication.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new CohortApplicationConflictError();
      }
      throw error;
    }
  }

  /** Throws `CohortApplicationEnrollmentAlreadyClaimedError` if `data` sets
   * `resultingEnrollmentId` to an enrollment another application row has
   * already claimed — the only unique constraint an `update()` (as opposed
   * to `create()`) can hit. This happens when `approve()`'s
   * resumability lookup (`EnrollmentsService.findByCohortAndUser`) finds a
   * *pre-existing* enrollment created by a wholly separate, already-approved
   * application for the same (cohort, user) — a genuine "already enrolled
   * via a different application" business conflict, not the same-application
   * retry the lookup was built to support. See
   * docs/adr/0010-cohort-applications.md. */
  async update(
    id: string,
    data: Prisma.CohortApplicationUncheckedUpdateInput,
    expectedVersion: number,
  ): Promise<CohortApplication> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.cohortApplication.findUniqueOrThrow({ where: { id } });
        if (current.version !== expectedVersion) {
          throw new CohortApplicationVersionConflictError(current.version);
        }
        return tx.cohortApplication.update({
          where: { id },
          data: { ...data, version: { increment: 1 } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new CohortApplicationEnrollmentAlreadyClaimedError();
      }
      throw error;
    }
  }

  /** The single source of truth for "is this cohort actually open for
   * applications" — reused by both the anonymous-prospect and
   * authenticated-student submit paths so the rule never drifts between
   * them. Deliberately direct-Prisma rather than `CohortsService.get()`:
   * that method now bakes in `MembershipsService.getAcademyScope()`, which
   * requires a real authenticated caller and would 404 everything for an
   * anonymous prospect. Collapses "doesn't exist" and "exists but not open"
   * into the same null result, matching `CohortsService.get()`'s own
   * academy-scope-mismatch convention. `expectedOrganizationId`, when
   * supplied (the authenticated-student path only), additionally confines
   * the lookup to the caller's own active organization. */
  async findApplyableCohort(
    cohortId: string,
    expectedOrganizationId?: string,
  ): Promise<ApplyableCohort | null> {
    const cohort = await this.prisma.cohort.findFirst({
      where: {
        id: cohortId,
        status: 'enrolling',
        deletedAt: null,
        ...(expectedOrganizationId ? { organizationId: expectedOrganizationId } : {}),
      },
    });
    if (!cohort) return null;

    const fellowship = await this.prisma.fellowship.findFirst({
      where: { id: cohort.fellowshipId, isPublic: true, status: 'published', deletedAt: null },
    });
    if (!fellowship) return null;

    const academy = await this.prisma.academy.findFirst({
      where: { id: cohort.academyId, isPublic: true, status: 'active', deletedAt: null },
    });
    if (!academy) return null;

    const organization = await this.prisma.organization.findFirst({
      where: { id: cohort.organizationId, status: 'active' },
    });
    if (!organization) return null;

    return { cohort, fellowship, academy };
  }

  /** A caller-supplied `requestedLearningTrackId` must resolve to a
   * currently-published track under the same fellowship — do **not** reuse
   * `LearningTracksService.get()`, which returns a track regardless of
   * status. */
  findApplyableTrack(trackId: string, fellowshipId: string): Promise<LearningTrack | null> {
    return this.prisma.learningTrack.findFirst({
      where: { id: trackId, fellowshipId, status: 'published', deletedAt: null },
    });
  }
}

export class CohortApplicationVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Cohort application has been modified since it was last read.');
  }
}

export class CohortApplicationConflictError extends Error {
  constructor() {
    super('An application for this cohort is already pending.');
  }
}

export class CohortApplicationEnrollmentAlreadyClaimedError extends Error {
  constructor() {
    super('This applicant is already enrolled in this cohort via a different application.');
  }
}
