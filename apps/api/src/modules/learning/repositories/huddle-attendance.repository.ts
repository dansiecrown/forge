import { Injectable } from '@nestjs/common';
import type { HuddleAttendance, HuddleAttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class HuddleAttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForSession(huddleSessionId: string): Promise<HuddleAttendance[]> {
    return this.prisma.huddleAttendance.findMany({ where: { huddleSessionId } });
  }

  /** Joined with its session so callers get `weekNumber`/`cohortId` without
   * a second round trip — the student's own attendance view and the
   * mentor's student-workspace tab both need this. */
  listForEnrollment(enrollmentId: string) {
    return this.prisma.huddleAttendance.findMany({
      where: { enrollmentId },
      include: { huddleSession: true },
      orderBy: { huddleSession: { weekNumber: 'asc' } },
    });
  }

  /** Upsert keyed on `(huddleSessionId, enrollmentId)` — attendance is
   * corrected in place, `recordedByMembershipId`/`recordedAt` track the
   * most recent correction. */
  upsert(
    huddleSessionId: string,
    enrollmentId: string,
    status: HuddleAttendanceStatus,
    recordedByMembershipId: string,
  ): Promise<HuddleAttendance> {
    return this.prisma.huddleAttendance.upsert({
      where: { huddleSessionId_enrollmentId: { huddleSessionId, enrollmentId } },
      update: { status, recordedByMembershipId, recordedAt: new Date() },
      create: { huddleSessionId, enrollmentId, status, recordedByMembershipId },
    });
  }
}
