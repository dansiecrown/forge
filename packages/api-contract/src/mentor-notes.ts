// Hand-authored request/response contracts for the Mentor Notes endpoints
// (Milestone 6 — Mentor Experience). Team-visible within a cohort's
// assigned mentors, never exposed to any student-facing route — see
// docs/adr/0008-mentor-experience.md Decision 6.

export interface MentorNote {
  id: string;
  cohortId: string;
  enrollmentId: string;
  authorMembershipId: string;
  body: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMentorNoteRequest {
  body: string;
}

export interface UpdateMentorNoteRequest {
  body: string;
}
