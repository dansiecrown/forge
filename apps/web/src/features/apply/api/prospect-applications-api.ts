import { apiRequest } from '@/api/client';
import type { CohortApplication, SubmitProspectApplicationRequest } from '@forge/api-contract';

export function submitProspectApplication(
  body: SubmitProspectApplicationRequest,
): Promise<CohortApplication> {
  return apiRequest<CohortApplication>('/public/cohort-applications', {
    method: 'POST',
    body,
    authenticated: false,
  });
}
