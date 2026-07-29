import type {
  ChangePasswordRequest,
  ConfirmMfaEnrollmentRequest,
  DisableMfaRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MfaEnrollResponse,
  MfaVerifyRequest,
  RefreshResponse,
  ResetPasswordRequest,
  SessionSummary,
} from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

export function login(body: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body, authenticated: false });
}

export function verifyMfa(body: MfaVerifyRequest, challengeToken: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/mfa/verify', {
    method: 'POST',
    body,
    authenticated: false,
    bearerTokenOverride: challengeToken,
  });
}

export function refreshSession(): Promise<RefreshResponse> {
  return apiRequest<RefreshResponse>('/auth/refresh', { method: 'POST', authenticated: false });
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST', authenticated: false });
}

export function forgotPassword(body: ForgotPasswordRequest): Promise<{ message: string }> {
  return apiRequest('/auth/forgot-password', { method: 'POST', body, authenticated: false });
}

export function resetPassword(body: ResetPasswordRequest): Promise<void> {
  return apiRequest<void>('/auth/reset-password', { method: 'POST', body, authenticated: false });
}

export function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me');
}

export function updateMe(body: { displayName?: string; timezone?: string; locale?: string }) {
  return apiRequest<{ id: string; displayName: string; timezone: string; locale: string }>('/me', {
    method: 'PATCH',
    body,
  });
}

export function changePassword(body: ChangePasswordRequest): Promise<void> {
  return apiRequest<void>('/auth/change-password', { method: 'POST', body });
}

export function listSessions(): Promise<Page<SessionSummary>> {
  return apiRequestPage<SessionSummary>('/auth/sessions');
}

export function revokeSession(sessionId: string): Promise<void> {
  return apiRequest<void>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
}

export function enrollMfa(): Promise<MfaEnrollResponse> {
  return apiRequest<MfaEnrollResponse>('/auth/mfa/enroll', {
    method: 'POST',
    body: { type: 'totp' },
  });
}

export function confirmMfaEnrollment(body: ConfirmMfaEnrollmentRequest): Promise<void> {
  return apiRequest<void>('/auth/mfa/confirm-enrollment', { method: 'POST', body });
}

export function disableMfa(body: DisableMfaRequest): Promise<void> {
  return apiRequest<void>('/auth/mfa/disable', { method: 'POST', body });
}
