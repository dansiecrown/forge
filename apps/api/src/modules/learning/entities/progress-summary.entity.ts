export interface ProgressSummaryEntity {
  enrollmentId: string;
  hasActiveTrack: boolean;
  learningTrackId: string | null;
  progressPercent: number;
  currentWeekNumber: number | null;
  currentModuleId: string | null;
  lockedModuleIds: string[];
  completedModuleIds: string[];
  estimatedCompletionDate: Date | null;
}
