import type {
  AttendanceStats,
  EnrollmentTrendPoint,
  FellowshipStats,
  MentorActivityRow,
  SubmissionStats,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function getEnrollmentTrends(
  organizationId: string,
  weeks = 8,
): Promise<EnrollmentTrendPoint[]> {
  return apiRequest<EnrollmentTrendPoint[]>(`/admin/reports/enrollment-trends?weeks=${weeks}`, {
    organizationId,
  });
}

export function getMentorActivity(organizationId: string): Promise<MentorActivityRow[]> {
  return apiRequest<MentorActivityRow[]>('/admin/reports/mentor-activity', { organizationId });
}

export function getSubmissionStats(
  organizationId: string,
  cohortId?: string,
): Promise<SubmissionStats> {
  const query = cohortId ? `?cohortId=${cohortId}` : '';
  return apiRequest<SubmissionStats>(`/admin/reports/submission-stats${query}`, { organizationId });
}

export function getAttendanceStats(
  cohortId: string,
  organizationId?: string,
): Promise<AttendanceStats> {
  return apiRequest<AttendanceStats>(`/admin/reports/attendance-stats?cohortId=${cohortId}`, {
    organizationId,
  });
}

export function getCompletionRates(
  fellowshipId: string,
  organizationId?: string,
): Promise<FellowshipStats> {
  return apiRequest<FellowshipStats>(
    `/admin/reports/completion-rates?fellowshipId=${fellowshipId}`,
    {
      organizationId,
    },
  );
}
