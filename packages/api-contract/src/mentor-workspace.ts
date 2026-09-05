// Hand-authored request/response contracts for the Mentor Portal's own
// workspace and dashboard endpoints (Milestone 6 — Mentor Experience).
// At-risk flags are always paired with a plain-language reason — never a
// bare score — see docs/adr/0008-mentor-experience.md Decision 6 and
// docs/KNOWN_TECHNICAL_DEBT.md (placeholder heuristics pending
// product-approved risk criteria).

import type { PortfolioProject } from './portfolio-projects';
import type { MentorNote } from './mentor-notes';
import type { HuddleSession, HuddleAttendanceWithWeek } from './huddles';

export interface MentorCohortSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  studentCount: number;
  atRiskCount: number;
}

export interface MentorStudentSummary {
  enrollmentId: string;
  userId: string;
  displayName: string;
  email: string;
  status: string;
  progressPercent: number;
  currentModuleId: string | null;
  currentWeekNumber: number | null;
  lastActivityAt: string | null;
  atRisk: boolean;
  atRiskReason: string | null;
}

export interface MentorStudentSubmissionView {
  id: string;
  practicalTaskId: string;
  taskTitle: string;
  status: string;
  repositoryUrl: string | null;
  liveDemoUrl: string | null;
  submittedAt: string | null;
}

export interface MentorStudentWorkspace {
  enrollmentId: string;
  userId: string;
  displayName: string;
  email: string;
  cohortId: string;
  cohortName: string;
  status: string;
  progressPercent: number;
  currentModuleId: string | null;
  currentWeekNumber: number | null;
  completedModuleIds: string[];
  lockedModuleIds: string[];
  submissions: MentorStudentSubmissionView[];
  portfolioProjects: PortfolioProject[];
  notes: MentorNote[];
  attendance: HuddleAttendanceWithWeek[];
  atRisk: boolean;
  atRiskReason: string | null;
}

export interface MentorReviewQueueItem {
  submissionId: string;
  enrollmentId: string;
  studentDisplayName: string;
  taskTitle: string;
  cohortId: string;
  cohortName: string;
  submittedAt: string | null;
  isResubmission: boolean;
}

export interface MentorDashboard {
  cohorts: MentorCohortSummary[];
  totalStudents: number;
  atRiskStudents: MentorStudentSummary[];
  reviewQueue: MentorReviewQueueItem[];
  recentHuddleSessions: HuddleSession[];
  recentNotes: MentorNote[];
}
