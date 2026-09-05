// Hand-authored request/response contracts for Reports & Analytics. See
// organizations.ts for the pattern this follows. "Simple charts only, no
// predictive analytics" — every shape here is a pre-aggregated count/rate.

export interface EnrollmentTrendPoint {
  weekStart: string;
  count: number;
}

export interface FellowshipStats {
  cohortCount: number;
  enrollmentCount: number;
  completedCount: number;
}

export interface AcademyStats {
  fellowshipCount: number;
  cohortCount: number;
  activeStudentCount: number;
  mentorCount: number;
  pendingReviewCount: number;
}

export interface OrganizationStats {
  academyCount: number;
  fellowshipCount: number;
  cohortCount: number;
  enrollmentCount: number;
  certificatesIssued: number;
}

export interface MentorActivityRow {
  membershipId: string;
  huddlesRecorded: number;
  reviewsRecorded: number;
}

export type SubmissionStats = Record<string, number>;
export type AttendanceStats = Record<string, number>;

export interface StudentActivityReport {
  activeCount: number;
  atRiskCount: number;
  students: {
    enrollmentId: string;
    displayName: string;
    progressPercent: number;
    atRisk: boolean;
    atRiskReason: string | null;
  }[];
}
