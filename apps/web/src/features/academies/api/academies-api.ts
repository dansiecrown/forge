import type {
  Academy,
  CreateAcademyRequest,
  ListAcademiesParams,
  UpdateAcademyRequest,
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

export function listAcademies(
  params: ListAcademiesParams,
  organizationId?: string,
): Promise<Page<Academy>> {
  return apiRequestPage<Academy>(`/academies${buildQuery(params)}`, { organizationId });
}

export function getAcademy(academyId: string, organizationId?: string): Promise<Academy> {
  return apiRequest<Academy>(`/academies/${academyId}`, { organizationId });
}

export function createAcademy(
  body: CreateAcademyRequest,
  organizationId?: string,
): Promise<Academy> {
  return apiRequest<Academy>('/academies', { method: 'POST', body, organizationId });
}

export function updateAcademy(
  academyId: string,
  body: UpdateAcademyRequest,
  version: number,
  organizationId?: string,
): Promise<Academy> {
  return apiRequest<Academy>(`/academies/${academyId}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function archiveAcademy(
  academyId: string,
  reason: string,
  organizationId?: string,
): Promise<Academy> {
  return apiRequest<Academy>(`/academies/${academyId}/actions/archive`, {
    method: 'POST',
    body: { reason },
    organizationId,
  });
}

export function restoreAcademy(academyId: string, organizationId?: string): Promise<Academy> {
  return apiRequest<Academy>(`/academies/${academyId}/actions/restore`, {
    method: 'POST',
    organizationId,
  });
}
