import type { Page } from '@/api/client';
import { apiRequest, apiRequestPage } from '@/api/client';
import type {
  BulkCohortApplicationActionRequest,
  BulkCohortApplicationResult,
  CohortApplication,
  CohortApplicationTransitionRequest,
  ListCohortApplicationsParams,
} from '@forge/api-contract';

function buildQuery(params: ListCohortApplicationsParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.fellowshipId) search.set('fellowshipId', params.fellowshipId);
  if (params.q) search.set('q', params.q);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listCohortApplications(
  params: ListCohortApplicationsParams,
  organizationId?: string,
): Promise<Page<CohortApplication>> {
  return apiRequestPage<CohortApplication>(`/admin/cohort-applications${buildQuery(params)}`, {
    organizationId,
  });
}

export function getCohortApplication(
  id: string,
  organizationId?: string,
): Promise<CohortApplication> {
  return apiRequest<CohortApplication>(`/admin/cohort-applications/${id}`, { organizationId });
}

export function approveCohortApplication(
  id: string,
  body: CohortApplicationTransitionRequest,
  organizationId?: string,
): Promise<CohortApplication> {
  return apiRequest<CohortApplication>(`/admin/cohort-applications/${id}/actions/approve`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function rejectCohortApplication(
  id: string,
  body: CohortApplicationTransitionRequest,
  organizationId?: string,
): Promise<CohortApplication> {
  return apiRequest<CohortApplication>(`/admin/cohort-applications/${id}/actions/reject`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function bulkApproveCohortApplications(
  body: BulkCohortApplicationActionRequest,
  organizationId?: string,
): Promise<BulkCohortApplicationResult[]> {
  return apiRequest<BulkCohortApplicationResult[]>(
    '/admin/cohort-applications/actions/bulk-approve',
    {
      method: 'POST',
      body,
      organizationId,
    },
  );
}

export function bulkRejectCohortApplications(
  body: BulkCohortApplicationActionRequest,
  organizationId?: string,
): Promise<BulkCohortApplicationResult[]> {
  return apiRequest<BulkCohortApplicationResult[]>(
    '/admin/cohort-applications/actions/bulk-reject',
    {
      method: 'POST',
      body,
      organizationId,
    },
  );
}
