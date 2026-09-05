import type {
  CreateLearningResourceRequest,
  LearningResource,
  ListLearningResourcesParams,
  ReorderItem,
  UpdateLearningResourceRequest,
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

export function listLearningResources(
  moduleId: string,
  params: ListLearningResourcesParams,
  organizationId?: string,
): Promise<Page<LearningResource>> {
  return apiRequestPage<LearningResource>(
    `/weekly-modules/${moduleId}/learning-resources${buildQuery(params)}`,
    { organizationId },
  );
}

export function getLearningResource(
  id: string,
  organizationId?: string,
): Promise<LearningResource> {
  return apiRequest<LearningResource>(`/learning-resources/${id}`, { organizationId });
}

export function createLearningResource(
  moduleId: string,
  body: CreateLearningResourceRequest,
  organizationId?: string,
): Promise<LearningResource> {
  return apiRequest<LearningResource>(`/weekly-modules/${moduleId}/learning-resources`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateLearningResource(
  id: string,
  body: UpdateLearningResourceRequest,
  version: number,
  organizationId?: string,
): Promise<LearningResource> {
  return apiRequest<LearningResource>(`/learning-resources/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function publishLearningResource(
  id: string,
  version: number,
  organizationId?: string,
): Promise<LearningResource> {
  return apiRequest<LearningResource>(`/learning-resources/${id}/actions/publish`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function archiveLearningResource(
  id: string,
  version: number,
  organizationId?: string,
): Promise<LearningResource> {
  return apiRequest<LearningResource>(`/learning-resources/${id}/actions/archive`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function restoreLearningResource(
  id: string,
  version: number,
  organizationId?: string,
): Promise<LearningResource> {
  return apiRequest<LearningResource>(`/learning-resources/${id}/actions/restore`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function reorderLearningResources(
  moduleId: string,
  items: ReorderItem[],
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/weekly-modules/${moduleId}/actions/reorder-resources`, {
    method: 'POST',
    body: { items },
    organizationId,
  });
}
