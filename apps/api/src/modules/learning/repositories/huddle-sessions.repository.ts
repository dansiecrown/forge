import { Injectable } from '@nestjs/common';
import type { HuddleSession } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

@Injectable()
export class HuddleSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<HuddleSession | null> {
    return this.prisma.huddleSession.findUnique({ where: { id } });
  }

  findByCohortAndWeek(cohortId: string, weekNumber: number): Promise<HuddleSession | null> {
    return this.prisma.huddleSession.findUnique({
      where: { cohortId_weekNumber: { cohortId, weekNumber } },
    });
  }

  listRecentForCohorts(cohortIds: string[], take: number): Promise<HuddleSession[]> {
    return this.prisma.huddleSession.findMany({
      where: { cohortId: { in: cohortIds } },
      orderBy: { updatedAt: 'desc' },
      take,
    });
  }

  /** Upsert on `(cohortId, weekNumber)` — one huddle record per cohort per
   * week, corrected in place rather than versioned. */
  upsert(
    scope: TenantScope,
    cohortId: string,
    weekNumber: number,
    createdByMembershipId: string,
    data: { notes?: string; discussionTopics?: string[]; actionItems?: string[] },
  ): Promise<HuddleSession> {
    return this.prisma.huddleSession.upsert({
      where: { cohortId_weekNumber: { cohortId, weekNumber } },
      update: { ...data, version: { increment: 1 } },
      create: {
        organizationId: scope.organizationId,
        cohortId,
        weekNumber,
        createdByMembershipId,
        ...data,
      },
    });
  }
}
