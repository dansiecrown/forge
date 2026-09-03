// Hand-authored request/response contracts for the Cohort Applications
// feature (self-service registration + prospect onboarding) — see
// docs/adr/0010-cohort-applications.md.

export interface CohortApplication {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  cohortId: string;
  applicantUserId: string | null;
  prospectEmail: string | null;
  prospectDisplayName: string | null;
  requestedLearningTrackId: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  resultingUserId: string | null;
  resultingEnrollmentId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitProspectApplicationRequest {
  cohortId: string;
  prospectEmail: string;
  prospectDisplayName: string;
  requestedLearningTrackId?: string;
  note?: string;
}

export interface SubmitStudentApplicationRequest {
  cohortId: string;
  requestedLearningTrackId?: string;
  note?: string;
}

export interface CohortApplicationTransitionRequest {
  version: number;
  reason?: string;
}

export interface ListCohortApplicationsParams {
  status?: string;
  cursor?: string;
  limit?: number;
}
