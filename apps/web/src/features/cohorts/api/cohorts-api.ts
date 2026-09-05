import type {
  Cohort,
  CohortMentorAssignment,
  CreateCohortRequest,
  CreateEnrollmentRequest,
  Enrollment,
  LearningTrack,
  ListCohortsParams,
  SelectEnrollmentTrackRequest,
  SetCohortTracksRequest,
  UpdateCohortRequest,
  UpdateEnrollmentRequest,
} from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

function buildQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listCohorts(
  params: ListCohortsParams,
  organizationId?: string,
): Promise<Page<Cohort>> {
  return apiRequestPage<Cohort>(`/cohorts${buildQuery(params)}`, { organizationId });
}

export function getCohort(id: string, organizationId?: string): Promise<Cohort> {
  return apiRequest<Cohort>(`/cohorts/${id}`, { organizationId });
}

export function createCohort(body: CreateCohortRequest, organizationId?: string): Promise<Cohort> {
  return apiRequest<Cohort>('/cohorts', { method: 'POST', body, organizationId });
}

export function updateCohort(
  id: string,
  body: UpdateCohortRequest,
  version: number,
  organizationId?: string,
): Promise<Cohort> {
  return apiRequest<Cohort>(`/cohorts/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

/** activate/pause/complete carry `version` in the body, not `If-Match`, per
 * docs/api-specification.md §4.6. */
function transitionCohort(id: string, action: string, version: number, organizationId?: string) {
  return apiRequest<Cohort>(`/cohorts/${id}/actions/${action}`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export const activateCohort = (id: string, version: number, organizationId?: string) =>
  transitionCohort(id, 'activate', version, organizationId);
export const pauseCohort = (id: string, version: number, organizationId?: string) =>
  transitionCohort(id, 'pause', version, organizationId);
export const completeCohort = (id: string, version: number, organizationId?: string) =>
  transitionCohort(id, 'complete', version, organizationId);
/** Regenerates this cohort's frozen curriculum snapshot from current live
 * curriculum state — the explicit "apply to this already-running cohort
 * now" action (docs/adr/0006-curriculum-learning-engine.md). */
export const syncCohortCurriculum = (id: string, version: number, organizationId?: string) =>
  transitionCohort(id, 'sync-curriculum', version, organizationId);
/** See docs/adr/0017-track-switch-grace-period.md — a manual per-cohort
 * switch, not a timer. */
export const closeCohortTrackSwitching = (id: string, version: number, organizationId?: string) =>
  transitionCohort(id, 'close-track-switching', version, organizationId);
export const reopenCohortTrackSwitching = (id: string, version: number, organizationId?: string) =>
  transitionCohort(id, 'reopen-track-switching', version, organizationId);

export function listCohortMentors(
  cohortId: string,
  organizationId?: string,
): Promise<CohortMentorAssignment[]> {
  return apiRequest<CohortMentorAssignment[]>(`/cohorts/${cohortId}/mentors`, { organizationId });
}

export function assignCohortMentor(
  cohortId: string,
  membershipId: string,
  organizationId?: string,
): Promise<CohortMentorAssignment> {
  return apiRequest<CohortMentorAssignment>(`/cohorts/${cohortId}/mentors`, {
    method: 'POST',
    body: { membershipId },
    organizationId,
  });
}

export function unassignCohortMentor(
  cohortId: string,
  membershipId: string,
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/cohorts/${cohortId}/mentors/${membershipId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export function listOfferedTracks(
  cohortId: string,
  organizationId?: string,
): Promise<LearningTrack[]> {
  return apiRequest<LearningTrack[]>(`/cohorts/${cohortId}/tracks`, { organizationId });
}

export function setOfferedTracks(
  cohortId: string,
  body: SetCohortTracksRequest,
  organizationId?: string,
): Promise<LearningTrack[]> {
  return apiRequest<LearningTrack[]>(`/cohorts/${cohortId}/tracks`, {
    method: 'PUT',
    body,
    organizationId,
  });
}

export function listEnrollments(
  cohortId: string,
  organizationId?: string,
): Promise<Page<Enrollment>> {
  return apiRequestPage<Enrollment>(`/cohorts/${cohortId}/enrollments`, { organizationId });
}

export function createEnrollment(
  cohortId: string,
  body: CreateEnrollmentRequest,
  organizationId?: string,
): Promise<Enrollment> {
  return apiRequest<Enrollment>(`/cohorts/${cohortId}/enrollments`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateEnrollment(
  id: string,
  body: UpdateEnrollmentRequest,
  version: number,
  organizationId?: string,
): Promise<Enrollment> {
  return apiRequest<Enrollment>(`/enrollments/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

/** Student self-service pick/switch — see
 * docs/adr/0017-track-switch-grace-period.md. */
export function selectEnrollmentTrack(
  id: string,
  body: SelectEnrollmentTrackRequest,
  organizationId?: string,
): Promise<Enrollment> {
  return apiRequest<Enrollment>(`/enrollments/${id}/actions/select-track`, {
    method: 'POST',
    body,
    organizationId,
  });
}
