// Hand-authored request/response contracts for the Admin Dashboard endpoint.
// See organizations.ts for the pattern this follows.

export interface AdminDashboard {
  organizationCount: number;
  academyCount: number;
  fellowshipCount: number;
  cohortCount: number;
  activeStudentCount: number;
  activeMentorCount: number;
  pendingReviewCount: number;
  enrollmentTrend: { weekStart: string; count: number }[];
  completionRate: number;
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorUserId: string | null;
    occurredAt: string;
  }[];
}
