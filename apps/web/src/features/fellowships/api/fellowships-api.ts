import type {
  CreateFellowshipRequest,
  Fellowship,
  ListFellowshipsParams,
  UpdateFellowshipRequest,
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

export function listFellowships(
  params: ListFellowshipsParams,
  organizationId?: string,
): Promise<Page<Fellowship>> {
  return apiRequestPage<Fellowship>(`/fellowships${buildQuery(params)}`, { organizationId });
}

export function getFellowship(id: string, organizationId?: string): Promise<Fellowship> {
  return apiRequest<Fellowship>(`/fellowships/${id}`, { organizationId });
}

export function createFellowship(
  body: CreateFellowshipRequest,
  organizationId?: string,
): Promise<Fellowship> {
  return apiRequest<Fellowship>('/fellowships', { method: 'POST', body, organizationId });
}

export function updateFellowship(
  id: string,
  body: UpdateFellowshipRequest,
  version: number,
  organizationId?: string,
): Promise<Fellowship> {
  return apiRequest<Fellowship>(`/fellowships/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

/** publish/retire carry `version` in the body, not `If-Match`, per
 * docs/api-specification.md §4.4 — see FellowshipTransitionDto. */
export function publishFellowship(
  id: string,
  version: number,
  organizationId?: string,
): Promise<Fellowship> {
  return apiRequest<Fellowship>(`/fellowships/${id}/actions/publish`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function retireFellowship(
  id: string,
  version: number,
  organizationId?: string,
): Promise<Fellowship> {
  return apiRequest<Fellowship>(`/fellowships/${id}/actions/retire`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

/** Milestone 7's duplicate/clone-curriculum action — always lands the copy
 * in `draft`, regardless of the source's status. */
export function duplicateFellowship(
  id: string,
  body: { title: string; slug: string; academyId?: string },
  organizationId?: string,
): Promise<Fellowship> {
  return apiRequest<Fellowship>(`/fellowships/${id}/actions/duplicate`, {
    method: 'POST',
    body,
    organizationId,
  });
}
