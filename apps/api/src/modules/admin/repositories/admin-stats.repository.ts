import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface PlatformCounts {
  organizationCount: number;
  academyCount: number;
  fellowshipCount: number;
  cohortCount: number;
  activeStudentCount: number;
  activeMentorCount: number;
  pendingReviewCount: number;
}

export interface OrganizationStats {
  academyCount: number;
  fellowshipCount: number;
  cohortCount: number;
  enrollmentCount: number;
  certificatesIssued: number;
}

export interface AcademyStats {
  fellowshipCount: number;
  cohortCount: number;
  activeStudentCount: number;
  mentorCount: number;
  pendingReviewCount: number;
}

export interface AcademyMentorAllocationRow {
  membershipId: string;
  cohortCount: number;
  studentCount: number;
}

/** Cross-cutting aggregation queries no single existing repository owns —
 * injects `PrismaService` directly, the same precedent
 * `CurriculumSnapshotService` already established for a read that spans
 * multiple entity types. Backs the Admin Dashboard, Organization/Academy/
 * Cohort stats, and Reports & Analytics — all "computed on read from
 * existing rows," never a stored time-series/materialized rollup, matching
 * `learning-stats.util.ts`'s precedent. See
 * docs/adr/0009-administration-platform.md. */
@Injectable()
export class AdminStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async countsForOrganizations(organizationId?: string): Promise<PlatformCounts> {
    const orgFilter = organizationId ? { organizationId } : {};
    const [
      organizationCount,
      academyCount,
      fellowshipCount,
      cohortCount,
      activeStudentCount,
      activeMentorMembershipIds,
      pendingReviewCount,
    ] = await Promise.all([
      organizationId ? Promise.resolve(1) : this.prisma.organization.count(),
      this.prisma.academy.count({ where: { deletedAt: null, ...orgFilter } }),
      this.prisma.fellowship.count({ where: { deletedAt: null, ...orgFilter } }),
      this.prisma.cohort.count({ where: { deletedAt: null, ...orgFilter } }),
      this.prisma.enrollment.count({ where: { status: 'active', ...orgFilter } }),
      this.prisma.cohortMentor.findMany({
        where: { unassignedAt: null, ...(organizationId ? { cohort: { organizationId } } : {}) },
        select: { membershipId: true },
        distinct: ['membershipId'],
      }),
      this.prisma.practicalTaskSubmission.count({
        where: {
          status: 'submitted',
          ...(organizationId ? { enrollment: { organizationId } } : {}),
        },
      }),
    ]);

    return {
      organizationCount,
      academyCount,
      fellowshipCount,
      cohortCount,
      activeStudentCount,
      activeMentorCount: activeMentorMembershipIds.length,
      pendingReviewCount,
    };
  }

  getPlatformCounts(): Promise<PlatformCounts> {
    return this.countsForOrganizations();
  }

  getOrganizationCounts(organizationId: string): Promise<PlatformCounts> {
    return this.countsForOrganizations(organizationId);
  }

  async getOrganizationStats(organizationId: string): Promise<OrganizationStats> {
    const [academyCount, fellowshipCount, cohortCount, enrollmentCount, certificatesIssued] =
      await Promise.all([
        this.prisma.academy.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.fellowship.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.cohort.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.enrollment.count({ where: { organizationId } }),
        this.prisma.certificate.count({ where: { organizationId, status: 'issued' } }),
      ]);
    return { academyCount, fellowshipCount, cohortCount, enrollmentCount, certificatesIssued };
  }

  getCompletedEnrollmentCount(organizationId: string): Promise<number> {
    return this.prisma.enrollment.count({ where: { organizationId, status: 'completed' } });
  }

  async getAcademyStats(academyId: string): Promise<AcademyStats> {
    const [
      fellowshipCount,
      cohortCount,
      activeStudentCount,
      mentorMembershipIds,
      pendingReviewCount,
    ] = await Promise.all([
      this.prisma.fellowship.count({ where: { academyId, deletedAt: null } }),
      this.prisma.cohort.count({ where: { academyId, deletedAt: null } }),
      this.prisma.enrollment.count({ where: { academyId, status: 'active' } }),
      this.prisma.cohortMentor.findMany({
        where: { unassignedAt: null, cohort: { academyId } },
        select: { membershipId: true },
        distinct: ['membershipId'],
      }),
      this.prisma.practicalTaskSubmission.count({
        where: { status: 'submitted', enrollment: { academyId } },
      }),
    ]);
    return {
      fellowshipCount,
      cohortCount,
      activeStudentCount,
      mentorCount: mentorMembershipIds.length,
      pendingReviewCount,
    };
  }

  async getAcademyMentorAllocation(academyId: string): Promise<AcademyMentorAllocationRow[]> {
    const assignments = await this.prisma.cohortMentor.findMany({
      where: { unassignedAt: null, cohort: { academyId } },
      select: { membershipId: true, cohortId: true },
    });
    const cohortIds = [...new Set(assignments.map((a) => a.cohortId))];
    const studentCounts = await this.prisma.enrollment.groupBy({
      by: ['cohortId'],
      where: { cohortId: { in: cohortIds }, status: 'active' },
      _count: true,
    });
    const studentCountByCohort = new Map(studentCounts.map((s) => [s.cohortId, s._count]));

    const byMembership = new Map<string, { cohortIds: Set<string>; studentCount: number }>();
    for (const assignment of assignments) {
      const entry = byMembership.get(assignment.membershipId) ?? {
        cohortIds: new Set<string>(),
        studentCount: 0,
      };
      entry.cohortIds.add(assignment.cohortId);
      entry.studentCount += studentCountByCohort.get(assignment.cohortId) ?? 0;
      byMembership.set(assignment.membershipId, entry);
    }

    return Array.from(byMembership.entries()).map(([membershipId, entry]) => ({
      membershipId,
      cohortCount: entry.cohortIds.size,
      studentCount: entry.studentCount,
    }));
  }

  async getEnrollmentCountForCohort(cohortId: string): Promise<number> {
    return this.prisma.enrollment.count({ where: { cohortId, status: 'active' } });
  }

  /** Weekly enrollment counts for the last `weeks` weeks — a fixed set of
   * pre-shaped buckets computed on read, no stored time-series. */
  async getEnrollmentTrends(
    organizationId: string,
    weeks: number,
  ): Promise<{ weekStart: string; count: number }[]> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - weeks * 7);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < weeks; i += 1) {
      const bucketStart = new Date(since);
      bucketStart.setUTCDate(bucketStart.getUTCDate() + i * 7);
      buckets.set(bucketStart.toISOString().slice(0, 10), 0);
    }
    for (const enrollment of enrollments) {
      const daysSince = Math.floor(
        (enrollment.createdAt.getTime() - since.getTime()) / (24 * 60 * 60 * 1000),
      );
      const weekIndex = Math.min(Math.floor(daysSince / 7), weeks - 1);
      const bucketStart = new Date(since);
      bucketStart.setUTCDate(bucketStart.getUTCDate() + weekIndex * 7);
      const key = bucketStart.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Array.from(buckets.entries()).map(([weekStart, count]) => ({ weekStart, count }));
  }

  async getMentorActivity(
    organizationId: string,
  ): Promise<{ membershipId: string; huddlesRecorded: number; reviewsRecorded: number }[]> {
    const [huddles, reviews] = await Promise.all([
      this.prisma.huddleSession.groupBy({
        by: ['createdByMembershipId'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.submissionReview.groupBy({
        by: ['reviewerMembershipId'],
        where: { organizationId },
        _count: true,
      }),
    ]);
    const byMembership = new Map<string, { huddlesRecorded: number; reviewsRecorded: number }>();
    for (const row of huddles) {
      byMembership.set(row.createdByMembershipId, {
        huddlesRecorded: row._count,
        reviewsRecorded: byMembership.get(row.createdByMembershipId)?.reviewsRecorded ?? 0,
      });
    }
    for (const row of reviews) {
      const existing = byMembership.get(row.reviewerMembershipId);
      byMembership.set(row.reviewerMembershipId, {
        huddlesRecorded: existing?.huddlesRecorded ?? 0,
        reviewsRecorded: row._count,
      });
    }
    return Array.from(byMembership.entries()).map(([membershipId, counts]) => ({
      membershipId,
      ...counts,
    }));
  }

  async getSubmissionStats(
    cohortId?: string,
    organizationId?: string,
  ): Promise<Record<string, number>> {
    const rows = await this.prisma.practicalTaskSubmission.groupBy({
      by: ['status'],
      where: {
        ...(cohortId ? { enrollment: { cohortId } } : {}),
        ...(organizationId ? { enrollment: { organizationId } } : {}),
      },
      _count: true,
    });
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = row._count;
    }
    return result;
  }

  async getAttendanceStats(cohortId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.huddleAttendance.groupBy({
      by: ['status'],
      where: { huddleSession: { cohortId } },
      _count: true,
    });
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = row._count;
    }
    return result;
  }

  /** Per-enrollment attendance rate — the "≥75% attendance" half of
   * Certificate Management's eligibility rule. */
  async getAttendanceRateForEnrollment(
    enrollmentId: string,
  ): Promise<{ presentCount: number; totalCount: number; rate: number }> {
    const rows = await this.prisma.huddleAttendance.findMany({
      where: { enrollmentId },
      select: { status: true },
    });
    const presentCount = rows.filter((r) => r.status === 'present').length;
    const totalCount = rows.length;
    return { presentCount, totalCount, rate: totalCount === 0 ? 0 : presentCount / totalCount };
  }

  async getFellowshipStats(
    fellowshipId: string,
  ): Promise<{ cohortCount: number; enrollmentCount: number; completedCount: number }> {
    const [cohortCount, enrollmentCount, completedCount] = await Promise.all([
      this.prisma.cohort.count({ where: { fellowshipId, deletedAt: null } }),
      this.prisma.enrollment.count({ where: { fellowshipId } }),
      this.prisma.enrollment.count({ where: { fellowshipId, status: 'completed' } }),
    ]);
    return { cohortCount, enrollmentCount, completedCount };
  }
}
