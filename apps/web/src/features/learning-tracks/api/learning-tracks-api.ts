import type {
  AssignFellowshipTrackMentorRequest,
  CreateLearningTrackRequest,
  FellowshipTrackMentorAssignment,
  LearningTrack,
  ListLearningTracksParams,
  ReorderItem,
  UpdateLearningTrackRequest,
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

export function listLearningTracks(
  fellowshipId: string,
  params: ListLearningTracksParams,
  organizationId?: string,
): Promise<Page<LearningTrack>> {
  return apiRequestPage<LearningTrack>(
    `/fellowships/${fellowshipId}/learning-tracks${buildQuery(params)}`,
    { organizationId },
  );
}

export function getLearningTrack(id: string, organizationId?: string): Promise<LearningTrack> {
  return apiRequest<LearningTrack>(`/learning-tracks/${id}`, { organizationId });
}

export function createLearningTrack(
  fellowshipId: string,
  body: CreateLearningTrackRequest,
  organizationId?: string,
): Promise<LearningTrack> {
  return apiRequest<LearningTrack>(`/fellowships/${fellowshipId}/learning-tracks`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateLearningTrack(
  id: string,
  body: UpdateLearningTrackRequest,
  version: number,
  organizationId?: string,
): Promise<LearningTrack> {
  return apiRequest<LearningTrack>(`/learning-tracks/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function publishLearningTrack(
  id: string,
  version: number,
  organizationId?: string,
): Promise<LearningTrack> {
  return apiRequest<LearningTrack>(`/learning-tracks/${id}/actions/publish`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function archiveLearningTrack(
  id: string,
  version: number,
  organizationId?: string,
): Promise<LearningTrack> {
  return apiRequest<LearningTrack>(`/learning-tracks/${id}/actions/archive`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function restoreLearningTrack(
  id: string,
  version: number,
  organizationId?: string,
): Promise<LearningTrack> {
  return apiRequest<LearningTrack>(`/learning-tracks/${id}/actions/restore`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function listTrackMentors(
  trackId: string,
  organizationId?: string,
): Promise<FellowshipTrackMentorAssignment[]> {
  return apiRequest<FellowshipTrackMentorAssignment[]>(`/learning-tracks/${trackId}/mentors`, {
    organizationId,
  });
}

export function assignTrackMentor(
  trackId: string,
  body: AssignFellowshipTrackMentorRequest,
  organizationId?: string,
): Promise<FellowshipTrackMentorAssignment> {
  return apiRequest<FellowshipTrackMentorAssignment>(`/learning-tracks/${trackId}/mentors`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function unassignTrackMentor(
  trackId: string,
  membershipId: string,
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/learning-tracks/${trackId}/mentors/${membershipId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export function reorderLearningTracks(
  fellowshipId: string,
  items: ReorderItem[],
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/fellowships/${fellowshipId}/actions/reorder-learning-tracks`, {
    method: 'POST',
    body: { items },
    organizationId,
  });
}
