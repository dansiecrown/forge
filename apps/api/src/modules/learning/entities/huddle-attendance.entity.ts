import type { HuddleAttendance } from '@prisma/client';

export interface HuddleAttendanceEntity {
  id: string;
  huddleSessionId: string;
  enrollmentId: string;
  status: string;
  recordedByMembershipId: string;
  recordedAt: Date;
}

export function toHuddleAttendanceEntity(row: HuddleAttendance): HuddleAttendanceEntity {
  return {
    id: row.id,
    huddleSessionId: row.huddleSessionId,
    enrollmentId: row.enrollmentId,
    status: row.status,
    recordedByMembershipId: row.recordedByMembershipId,
    recordedAt: row.recordedAt,
  };
}

/** The student's own attendance view and the mentor's student-workspace tab
 * both need `weekNumber` alongside the status — this is the joined shape
 * `HuddleAttendanceRepository.listForEnrollment` returns. */
export interface HuddleAttendanceWithWeekEntity extends HuddleAttendanceEntity {
  weekNumber: number;
}
