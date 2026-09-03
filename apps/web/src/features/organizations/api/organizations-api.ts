import type {
  CreateOrganizationRequest,
  ListOrganizationsParams,
  Organization,
  UpdateOrganizationRequest,
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

export function listOrganizations(
  params: ListOrganizationsParams,
  organizationId?: string,
): Promise<Page<Organization>> {
  return apiRequestPage<Organization>(`/organizations${buildQuery(params)}`, { organizationId });
}

export function getOrganization(orgId: string, organizationId?: string): Promise<Organization> {
  return apiRequest<Organization>(`/organizations/${orgId}`, { organizationId });
}

export function createOrganization(body: CreateOrganizationRequest): Promise<Organization> {
  return apiRequest<Organization>('/organizations', { method: 'POST', body });
}

export function updateOrganization(
  orgId: string,
  body: UpdateOrganizationRequest,
  version: number,
  organizationId?: string,
): Promise<Organization> {
  return apiRequest<Organization>(`/organizations/${orgId}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function suspendOrganization(orgId: string, reason: string): Promise<Organization> {
  return apiRequest<Organization>(`/organizations/${orgId}/actions/suspend`, {
    method: 'POST',
    body: { reason },
  });
}

export function archiveOrganization(orgId: string, reason: string): Promise<Organization> {
  return apiRequest<Organization>(`/organizations/${orgId}/actions/archive`, {
    method: 'POST',
    body: { reason },
  });
}

export function restoreOrganization(orgId: string): Promise<Organization> {
  return apiRequest<Organization>(`/organizations/${orgId}/actions/restore`, { method: 'POST' });
}

export interface UserMembershipSummary {
  id: string;
  organizationId: string;
  status: string;
}

/** Used to resolve a person picked by email/name (an `AdminUser.id`) down
 * to their membership id in the active organization — e.g. for cohort
 * mentor assignment, which is keyed by membership, not user. */
export function getUserMemberships(
  userId: string,
  organizationId?: string,
): Promise<UserMembershipSummary[]> {
  return apiRequest<UserMembershipSummary[]>(`/users/${userId}/memberships`, { organizationId });
}
