import type { ApiErrorDetail, ApiErrorEnvelope, ApiSuccessEnvelope } from '@forge/api-contract';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiClientHooks {
  getAccessToken: () => string | null;
  /** Performs the refresh-cookie round trip and returns the new access
   * token, or null if the session could not be renewed. */
  refreshAccessToken: () => Promise<string | null>;
  onSessionExpired: () => void;
}

let hooks: ApiClientHooks = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
  onSessionExpired: () => {},
};

export function configureApiClient(nextHooks: ApiClientHooks): void {
  hooks = nextHooks;
}

// Concurrent 401s share a single in-flight refresh instead of each racing
// their own, per docs/system-architecture.md §3 "concurrent refreshes are coalesced".
let inFlightRefresh: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = hooks.refreshAccessToken().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
  organizationId?: string;
  /** Sends this bearer token instead of the session's access token — used
   * for the MFA login-challenge step, which authenticates with a
   * short-lived challenge token rather than a full session. */
  bearerTokenOverride?: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const {
    method = 'GET',
    body,
    authenticated = true,
    organizationId,
    bearerTokenOverride,
  } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerTokenOverride) {
    headers.Authorization = `Bearer ${bearerTokenOverride}`;
  } else if (authenticated) {
    const token = hooks.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (organizationId) headers['X-Organization-Id'] = organizationId;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && authenticated && !isRetry) {
    const newToken = await refreshOnce();
    if (newToken) {
      return apiRequest<T>(path, options, true);
    }
    hooks.onSessionExpired();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as
    ApiSuccessEnvelope<T> | ApiErrorEnvelope | null;

  if (!response.ok) {
    const errorPayload = (payload as ApiErrorEnvelope | null)?.error;
    throw new ApiError(
      errorPayload?.code ?? 'UNKNOWN_ERROR',
      errorPayload?.message ?? 'Something went wrong. Please try again.',
      response.status,
      errorPayload?.details,
      errorPayload?.requestId,
    );
  }

  return (payload as ApiSuccessEnvelope<T>).data;
}
