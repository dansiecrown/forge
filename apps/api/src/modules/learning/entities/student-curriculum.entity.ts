import type { ModuleLockState } from '../services/progression.service';

export interface StudentModuleSummary {
  id: string;
  weekNumber: number;
  title: string;
  summary: string | null;
  status: string;
  lockState: ModuleLockState;
  unlockDate: string | null;
  requiresMentorHuddle: boolean;
  requiresPracticalWork: boolean;
  lessonCount: number;
  resourceCount: number;
  taskCount: number;
}

export interface StudentLessonSummary {
  id: string;
  title: string;
  lessonType: string;
  estimatedDurationMinutes: number | null;
  completionRequired: boolean;
  completed: boolean;
  displayOrder: number;
}

export interface StudentResourceSummary {
  id: string;
  title: string;
  resourceType: string;
  url: string | null;
  author: string | null;
  provider: string | null;
  estimatedDurationMinutes: number | null;
  notes: string | null;
  isRequired: boolean;
  acknowledged: boolean;
  bookmarked: boolean;
  displayOrder: number;
  moduleId: string;
  moduleTitle: string;
  weekNumber: number;
}

export interface StudentTaskSubmissionView {
  id: string;
  status: string;
  repositoryUrl: string | null;
  liveDemoUrl: string | null;
  submittedAt: string | null;
}

export interface StudentTaskSummary {
  id: string;
  title: string;
  description: string | null;
  dueOffsetDays: number | null;
  dueDate: string | null;
  displayOrder: number;
  moduleId: string;
  moduleTitle: string;
  weekNumber: number;
  submission: StudentTaskSubmissionView | null;
}

export interface StudentModuleDetail {
  id: string;
  weekNumber: number;
  title: string;
  objectives: string[];
  summary: string | null;
  estimatedStudyHours: number | null;
  status: string;
  lockState: ModuleLockState;
  unlockDate: string | null;
  requiresMentorHuddle: boolean;
  huddleScheduleMetadata: unknown;
  huddleMeetingLink: string | null;
  mentorHuddleNotes: string | null;
  huddleAttendanceRequired: boolean;
  requiresPracticalWork: boolean;
  lessons: StudentLessonSummary[];
  resources: Omit<StudentResourceSummary, 'moduleId' | 'moduleTitle' | 'weekNumber'>[];
  practicalTasks: Omit<StudentTaskSummary, 'moduleId' | 'moduleTitle' | 'weekNumber'>[];
}

export interface StudentLessonDetail {
  id: string;
  moduleId: string;
  moduleTitle: string;
  weekNumber: number;
  title: string;
  description: string | null;
  lessonType: string;
  estimatedDurationMinutes: number | null;
  resourceUrl: string | null;
  attachmentMetadata: unknown;
  embeddedContentMetadata: unknown;
  completionRequired: boolean;
  completed: boolean;
  previousLessonId: string | null;
  nextLessonId: string | null;
}

export interface StudentActivityItem {
  type: 'lesson' | 'resource' | 'task';
  id: string;
  title: string;
  moduleId: string;
  occurredAt: string;
}

export interface StudentDashboard {
  hasActiveTrack: boolean;
  progressPercent: number;
  currentWeekNumber: number | null;
  currentModuleId: string | null;
  streakDays: number;
  estimatedMinutesLearned: number;
  estimatedCompletionDate: string | null;
  nextUp: { lessonId: string; title: string; moduleId: string } | null;
  upcomingDeadlines: { taskId: string; title: string; moduleId: string; dueDate: string }[];
  recentActivity: StudentActivityItem[];
}
