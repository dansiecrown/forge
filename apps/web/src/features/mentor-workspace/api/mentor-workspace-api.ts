import type {
  MentorCohortSummary,
  MentorDashboard,
  MentorReviewQueueItem,
  MentorStudentSummary,
  MentorStudentWorkspace,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

function buildQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | undefined][]) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listMyCohorts(organizationId?: string): Promise<MentorCohortSummary[]> {
  return apiRequest<MentorCohortSummary[]>('/mentors/me/cohorts', { organizationId });
}

export function getMentorDashboard(organizationId?: string): Promise<MentorDashboard> {
  return apiRequest<MentorDashboard>('/mentors/me/dashboard', { organizationId });
}

export function listReviewQueue(organizationId?: string): Promise<MentorReviewQueueItem[]> {
  return apiRequest<MentorReviewQueueItem[]>('/mentors/me/review-queue', { organizationId });
}

export interface ListCohortStudentsParams {
  q?: string;
  status?: string;
  sort?: 'name' | 'progress' | 'status';
}

export function listCohortStudents(
  cohortId: string,
  params: ListCohortStudentsParams,
  organizationId?: string,
): Promise<MentorStudentSummary[]> {
  return apiRequest<MentorStudentSummary[]>(
    `/mentors/cohorts/${cohortId}/students${buildQuery(params)}`,
    { organizationId },
  );
}

export function getStudentWorkspace(
  enrollmentId: string,
  organizationId?: string,
): Promise<MentorStudentWorkspace> {
  return apiRequest<MentorStudentWorkspace>(`/mentors/students/${enrollmentId}/workspace`, {
    organizationId,
  });
}
