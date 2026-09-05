// Hand-authored request/response contracts for the Mentor weekly-huddle
// endpoints (Milestone 6 — Mentor Experience). No scheduling system, no
// calendar, no video-conferencing integration — a mentor records what
// happened after the fact. See docs/adr/0008-mentor-experience.md
// Decision 1.

export interface HuddleSession {
  id: string;
  cohortId: string;
  weekNumber: number;
  notes: string | null;
  discussionTopics: string[];
  actionItems: string[];
  createdByMembershipId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertHuddleSessionRequest {
  notes?: string;
  discussionTopics?: string[];
  actionItems?: string[];
}

export type HuddleAttendanceStatus = 'present' | 'absent' | 'excused';

export interface HuddleAttendance {
  id: string;
  huddleSessionId: string;
  enrollmentId: string;
  status: HuddleAttendanceStatus;
  recordedByMembershipId: string;
  recordedAt: string;
}

/** `GET /enrollments/:id/attendance` joins in the session's `weekNumber` —
 * both the student's own attendance view and the mentor's student-workspace
 * tab need it alongside the status. */
export interface HuddleAttendanceWithWeek extends HuddleAttendance {
  weekNumber: number;
}

export interface HuddleAttendanceEntry {
  enrollmentId: string;
  status: HuddleAttendanceStatus;
}

export interface RecordHuddleAttendanceRequest {
  entries: HuddleAttendanceEntry[];
}
