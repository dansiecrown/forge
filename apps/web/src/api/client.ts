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

/** The current access token, for the one caller outside this module that
 * legitimately needs it directly: the chat WebSocket connection
 * (`features/chat`), which authenticates its handshake the same way every
 * REST call does (`ChatGateway.handleConnection` verifies the same access
 * token `performRequest` sends as a Bearer header) but can't go through
 * `performRequest` itself since it isn't an HTTP request. */
export function getCurrentAccessToken(): string | null {
  return hooks.getAccessToken();
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
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
  organizationId?: string;
  /** Sends this bearer token instead of the session's access token — used
   * for the MFA login-challenge step, which authenticates with a
   * short-lived challenge token rather than a full session. */
  bearerTokenOverride?: string;
  /** Optimistic-concurrency version for `PATCH` requests
   * (docs/api-specification.md §2 `If-Match`). */
  ifMatch?: number;
}

export interface PageMeta {
  nextCursor: string | null;
  previousCursor: string | null;
  limit: number;
  hasMore: boolean;
}

export interface Page<T> {
  items: T[];
  page: PageMeta;
}

/** Shared HTTP mechanics (auth header, tenant header, 401 refresh-and-retry,
 * error envelope unwrapping) for both `apiRequest` (single resource) and
 * `apiRequestPage` (cursor-paginated collection) below. */
async function performRequest(
  path: string,
  options: RequestOptions,
  isRetry = false,
): Promise<{ status: number; payload: ApiSuccessEnvelope<unknown> | null }> {
  const {
    method = 'GET',
    body,
    authenticated = true,
    organizationId,
    bearerTokenOverride,
    ifMatch,
  } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerTokenOverride) {
    headers.Authorization = `Bearer ${bearerTokenOverride}`;
  } else if (authenticated) {
    const token = hooks.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (organizationId) headers['X-Organization-Id'] = organizationId;
  if (ifMatch !== undefined) headers['If-Match'] = String(ifMatch);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && authenticated && !isRetry) {
    const newToken = await refreshOnce();
    if (newToken) {
      return performRequest(path, options, true);
    }
    hooks.onSessionExpired();
  }

  if (response.status === 204) {
    return { status: response.status, payload: null };
  }

  const payload = (await response.json().catch(() => null)) as
    ApiSuccessEnvelope<unknown> | ApiErrorEnvelope | null;

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

  return { status: response.status, payload: payload as ApiSuccessEnvelope<unknown> };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { status, payload } = await performRequest(path, options);
  if (status === 204) return undefined as T;
  return (payload as ApiSuccessEnvelope<T>).data;
}

/** Same as `apiRequest`, but also surfaces `meta.page` for cursor-paginated
 * list endpoints (docs/api-specification.md §2 "Collections"). */
export async function apiRequestPage<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Page<T>> {
  const { payload } = await performRequest(path, options);
  const success = payload as ApiSuccessEnvelope<T[]> & { meta: { page: PageMeta } };
  return { items: success.data, page: success.meta.page };
}
