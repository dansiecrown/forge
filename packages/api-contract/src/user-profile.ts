// Hand-authored request/response contracts for the self-service profile
// endpoints (Milestone 5 — Student Experience; generalized to any role in
// Milestone 6 — Mentor Experience). One row per platform identity, not per
// organization membership — see docs/adr/0007-student-experience.md and
// docs/adr/0008-mentor-experience.md Decision 4.

export interface UserProfile {
  bio: string | null;
  /** Labeled "Skills" for students, "Areas of Expertise" for mentors — same
   * underlying field, relabeled per-role in the UI only. */
  skills: string[];
  interests: string[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  /** Mentor-only field in the UI ("Availability"); unused for students. */
  availability: string | null;
  learningPreferencesMetadata: unknown;
  /** `0` means no profile row exists yet — not a 404, a profile is
   * optional-by-default state. */
  version: number;
  updatedAt: string;
}

export interface UpdateUserProfileRequest {
  bio?: string;
  skills?: string[];
  interests?: string[];
  githubUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  availability?: string;
  learningPreferencesMetadata?: Record<string, unknown>;
}
