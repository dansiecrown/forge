// Hand-authored request/response contracts for the Weekly Modules endpoints
// (Milestone 4 — Curriculum & Learning Engine). One row per fellowship week,
// collapsing docs/database-design.md's separate Module/Week levels — see
// docs/adr/0006-curriculum-learning-engine.md Decision 2.

export interface WeeklyModule {
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
  unlockRules: Record<string, unknown> | null;
  huddleScheduleMetadata: Record<string, unknown> | null;
  huddleMeetingLink: string | null;
  mentorHuddleNotes: string | null;
  huddleAttendanceRequired: boolean;
  status: 'draft' | 'published' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWeeklyModuleRequest {
  weekNumber: number;
  title: string;
  objectives?: string[];
  summary?: string;
  estimatedStudyHours?: number;
  requiresMentorHuddle?: boolean;
  requiresPracticalWork?: boolean;
  unlockRules?: Record<string, unknown>;
  huddleScheduleMetadata?: Record<string, unknown>;
  huddleMeetingLink?: string;
  mentorHuddleNotes?: string;
  huddleAttendanceRequired?: boolean;
}

export interface UpdateWeeklyModuleRequest {
  weekNumber?: number;
  title?: string;
  objectives?: string[];
  summary?: string;
  estimatedStudyHours?: number;
  requiresMentorHuddle?: boolean;
  requiresPracticalWork?: boolean;
  unlockRules?: Record<string, unknown>;
  huddleScheduleMetadata?: Record<string, unknown>;
  huddleMeetingLink?: string;
  mentorHuddleNotes?: string;
  huddleAttendanceRequired?: boolean;
}

export interface ListWeeklyModulesParams {
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}
