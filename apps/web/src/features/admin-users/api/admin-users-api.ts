import type { AdminAuditLogEntry, AdminSessionSummary } from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

interface AdminUser {
  id: string;
  displayName: string;
  emailCanonical: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listAdminUsers(
  q: string | undefined,
  cursor: string | undefined,
  organizationId?: string,
) {
  return apiRequestPage<AdminUser>(`/admin/users${buildQuery({ q, cursor })}`, { organizationId });
}

export function getAdminUser(userId: string, organizationId?: string): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/admin/users/${userId}`, { organizationId });
}

export interface InviteUserInput {
  email: string;
  displayName: string;
  roles?: string[];
}

export interface InviteUserResult {
  invitationId: string;
  status: 'sent' | 'added';
}

/** Assigns a membership by inviting a person into the active organization —
 * reuses the identity module's existing `POST /users/invitations` verbatim
 * (the same mechanism the Cohort Applications approval flow already calls),
 * rather than a new admin-specific invite path. */
export function inviteUser(
  body: InviteUserInput,
  organizationId?: string,
): Promise<InviteUserResult> {
  return apiRequest<InviteUserResult>('/users/invitations', {
    method: 'POST',
    body,
    organizationId,
  });
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  roleKeys: string[];
  /** Required only when `roleKeys` includes `ACADEMY_ADMIN`. */
  academyId?: string;
}

export interface CreateUserResult {
  id: string;
  displayName: string;
  email: string;
}

/** Admin-set-password creation, alongside (not instead of) `inviteUser`
 * above — see docs/adr/0009-administration-platform.md's addendum. The
 * person can log in immediately with the password the admin set here. */
export function createUser(
  body: CreateUserInput,
  organizationId?: string,
): Promise<CreateUserResult> {
  return apiRequest<CreateUserResult>('/admin/users', {
    method: 'POST',
    body,
    organizationId,
  });
}

export function suspendUser(userId: string, organizationId: string): Promise<void> {
  return apiRequest(`/admin/users/${userId}/actions/suspend`, { method: 'POST', organizationId });
}

export function reactivateUser(userId: string, organizationId: string): Promise<void> {
  return apiRequest(`/admin/users/${userId}/actions/reactivate`, {
    method: 'POST',
    organizationId,
  });
}

export function resetMfa(userId: string, organizationId: string): Promise<void> {
  return apiRequest(`/admin/users/${userId}/actions/reset-mfa`, { method: 'POST', organizationId });
}

export function forcePasswordReset(userId: string, organizationId: string): Promise<void> {
  return apiRequest(`/admin/users/${userId}/actions/force-password-reset`, {
    method: 'POST',
    organizationId,
  });
}

export function listUserSessions(
  userId: string,
  organizationId: string,
): Promise<Page<AdminSessionSummary>> {
  return apiRequestPage<AdminSessionSummary>(`/admin/users/${userId}/sessions`, { organizationId });
}

export function revokeSession(
  userId: string,
  sessionId: string,
  organizationId: string,
): Promise<void> {
  return apiRequest(`/admin/users/${userId}/sessions/${sessionId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export function revokeAllSessions(userId: string, organizationId: string): Promise<void> {
  return apiRequest(`/admin/users/${userId}/sessions/actions/revoke-all`, {
    method: 'POST',
    organizationId,
  });
}

export function getLoginHistory(
  userId: string,
  organizationId: string,
): Promise<Page<AdminAuditLogEntry>> {
  return apiRequestPage<AdminAuditLogEntry>(`/admin/users/${userId}/login-history`, {
    organizationId,
  });
}

export type { AdminUser };
