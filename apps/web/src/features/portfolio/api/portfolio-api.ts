import type {
  CreatePortfolioProjectRequest,
  PortfolioProject,
  UpdatePortfolioProjectRequest,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function listPortfolioProjects(enrollmentId: string, organizationId?: string) {
  return apiRequest<PortfolioProject[]>(`/enrollments/${enrollmentId}/portfolio-projects`, {
    organizationId,
  });
}

export function createPortfolioProject(
  enrollmentId: string,
  body: CreatePortfolioProjectRequest,
  organizationId?: string,
) {
  return apiRequest<PortfolioProject>(`/enrollments/${enrollmentId}/portfolio-projects`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updatePortfolioProject(
  id: string,
  body: UpdatePortfolioProjectRequest,
  version: number,
  organizationId?: string,
) {
  return apiRequest<PortfolioProject>(`/portfolio-projects/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function deletePortfolioProject(id: string, version: number, organizationId?: string) {
  return apiRequest<void>(`/portfolio-projects/${id}`, {
    method: 'DELETE',
    organizationId,
    ifMatch: version,
  });
}

function transitionPortfolioProject(
  id: string,
  action: 'publish' | 'unpublish',
  version: number,
  organizationId?: string,
) {
  return apiRequest<PortfolioProject>(`/portfolio-projects/${id}/actions/${action}`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export const publishPortfolioProject = (id: string, version: number, organizationId?: string) =>
  transitionPortfolioProject(id, 'publish', version, organizationId);
export const unpublishPortfolioProject = (id: string, version: number, organizationId?: string) =>
  transitionPortfolioProject(id, 'unpublish', version, organizationId);
