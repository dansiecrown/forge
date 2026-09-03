import type { Page } from '@/api/client';
import { apiRequest, apiRequestPage } from '@/api/client';
import type {
  CohortApplication,
  CohortApplicationTransitionRequest,
  SubmitStudentApplicationRequest,
} from '@forge/api-contract';

export function submitStudentApplication(
  body: SubmitStudentApplicationRequest,
  organizationId?: string,
): Promise<CohortApplication> {
  return apiRequest<CohortApplication>('/cohort-applications', {
    method: 'POST',
    body,
    organizationId,
  });
}

export function listMyApplications(organizationId?: string): Promise<Page<CohortApplication>> {
  return apiRequestPage<CohortApplication>('/cohort-applications/me', { organizationId });
}

export function withdrawApplication(
  id: string,
  body: CohortApplicationTransitionRequest,
  organizationId?: string,
): Promise<CohortApplication> {
  return apiRequest<CohortApplication>(`/cohort-applications/${id}/actions/withdraw`, {
    method: 'POST',
    body,
    organizationId,
  });
}
