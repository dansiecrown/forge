// Hand-authored request/response contracts for the identity & access control
// endpoints. These stand in for a generated OpenAPI client — no codegen
// pipeline exists yet (see Milestone 2 report). Keeping the shapes here,
// not duplicated in apps/web, is what docs/project-structure.md requires:
// "the web application imports [api-contract]; it does not duplicate DTOs."

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  };
}

export interface ApiSuccessEnvelope<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface PublicUser {
  id: string;
  displayName: string;
  email: string;
  status: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginSuccessResponse {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
  mfaRequired: false;
}

export interface LoginMfaRequiredResponse {
  mfaRequired: true;
  mfaChallengeToken: string;
}

export type LoginResponse = LoginSuccessResponse | LoginMfaRequiredResponse;

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface MfaVerifyRequest {
  factorId?: string;
  code: string;
}

export interface MfaEnrollResponse {
  factorId: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

export interface SessionSummary {
  id: string;
  device: string;
  current: boolean;
  lastUsedAt: string;
}

export interface MeResponse {
  id: string;
  displayName: string;
  email: string;
  status: string;
  timezone: string;
  locale: string;
  emailVerified: boolean;
  memberships: { organizationId: string; status: string; roles: string[] }[];
}
