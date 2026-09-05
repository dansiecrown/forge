import type { PortfolioProjectEntity } from './portfolio-project.entity';
import type { MentorNoteEntity } from './mentor-note.entity';
import type { HuddleSessionEntity } from './huddle-session.entity';
import type { HuddleAttendanceWithWeekEntity } from './huddle-attendance.entity';

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
  /** `false` when there is no active track to measure progress against —
   * never a bare label, always paired with `atRiskReason`. */
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
  portfolioProjects: PortfolioProjectEntity[];
  notes: MentorNoteEntity[];
  attendance: HuddleAttendanceWithWeekEntity[];
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
  /** A submission with a prior `revision_requested` review predating its
   * current `submittedAt` — see `SubmissionReviewsService.listHistory`. */
  isResubmission: boolean;
}

export interface MentorDashboard {
  cohorts: MentorCohortSummary[];
  totalStudents: number;
  atRiskStudents: MentorStudentSummary[];
  reviewQueue: MentorReviewQueueItem[];
  recentHuddleSessions: HuddleSessionEntity[];
  recentNotes: MentorNoteEntity[];
}
