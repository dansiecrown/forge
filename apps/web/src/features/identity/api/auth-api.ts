import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MfaVerifyRequest,
  RefreshResponse,
  ResetPasswordRequest,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

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
