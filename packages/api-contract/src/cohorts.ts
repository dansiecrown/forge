// Hand-authored request/response contracts for the Cohorts and Enrollments
// endpoints (docs/api-specification.md §4.6, cohort/enrollment/mentor-
// assignment only — huddles/attendance are out of scope for Milestone 3).

export interface Cohort {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  status: 'draft' | 'enrolling' | 'active' | 'paused' | 'completed' | 'archived';
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  description: string | null;
  enrollmentDeadline: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCohortRequest {
  fellowshipId: string;
  name: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  description?: string;
  enrollmentDeadline?: string;
}

export interface UpdateCohortRequest {
  name?: string;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  capacity?: number;
  description?: string;
  enrollmentDeadline?: string;
  status?: 'enrolling' | 'archived';
}

export interface ListCohortsParams {
  fellowshipId?: string;
  academyId?: string;
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface CohortMentorAssignment {
  id: string;
  cohortId: string;
  membershipId: string;
  assignedAt: string;
}

export interface Enrollment {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  cohortId: string;
  userId: string;
  status: 'invited' | 'active' | 'paused' | 'completed' | 'withdrawn';
  invitedAt: string;
  joinedAt: string | null;
  endedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnrollmentRequest {
  studentUserId: string;
}

export interface UpdateEnrollmentRequest {
  status: 'invited' | 'active' | 'paused' | 'completed' | 'withdrawn';
  reason?: string;
}
