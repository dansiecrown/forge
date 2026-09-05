import type { WeeklyModule } from '@prisma/client';

export interface WeeklyModuleEntity {
  id: string;
  organizationId: string;
  courseId: string;
  weekNumber: number;
  title: string;
  objectives: string[];
  summary: string | null;
  estimatedStudyHours: number | null;
  requiresMentorHuddle: boolean;
  requiresPracticalWork: boolean;
  unlockRules: unknown;
  huddleScheduleMetadata: unknown;
  huddleMeetingLink: string | null;
  mentorHuddleNotes: string | null;
  huddleAttendanceRequired: boolean;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toWeeklyModuleEntity(row: WeeklyModule): WeeklyModuleEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    courseId: row.courseId,
    weekNumber: row.weekNumber,
    title: row.title,
    objectives: row.objectives,
    summary: row.summary,
    estimatedStudyHours: row.estimatedStudyHours,
    requiresMentorHuddle: row.requiresMentorHuddle,
    requiresPracticalWork: row.requiresPracticalWork,
    unlockRules: row.unlockRules,
    huddleScheduleMetadata: row.huddleScheduleMetadata,
    huddleMeetingLink: row.huddleMeetingLink,
    mentorHuddleNotes: row.mentorHuddleNotes,
    huddleAttendanceRequired: row.huddleAttendanceRequired,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
