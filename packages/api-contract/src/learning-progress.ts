// Hand-authored request/response contracts for the learner progression
// endpoints (Milestone 4, Part G — the Progression Engine). No student
// portal UI consumes these this milestone; they exist for the API + tests
// the brief requires. See docs/adr/0006-curriculum-learning-engine.md.

export interface ProgressSummary {
  enrollmentId: string;
  hasActiveTrack: boolean;
  learningTrackId: string | null;
  progressPercent: number;
  currentWeekNumber: number | null;
  currentModuleId: string | null;
  lockedModuleIds: string[];
  completedModuleIds: string[];
  estimatedCompletionDate: string | null;
}

// Milestone 5 additions — a Practical Task submission is now saved as a
// draft first, then explicitly submitted (docs/adr/0007-student-experience.md).

export interface SaveTaskSubmissionDraftRequest {
  enrollmentId: string;
  repositoryUrl?: string;
  liveDemoUrl?: string;
}

export interface SubmitTaskRequest {
  enrollmentId: string;
}
