import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/** Milestone 8 production hardening: `new QueryClient()` with no options
 * (the previous state) applies TanStack Query's own default retry (3
 * attempts, exponential backoff) to every failed query, including a 401,
 * 403, 404, or 409 — errors retrying can never fix, that only delay the
 * error state a query/mutation's caller actually needs to react to (a 401
 * in particular is already handled by `performRequest`'s own
 * refresh-and-retry-once logic in `client.ts`; letting React Query retry
 * the same request again on top of that just repeats a failure that
 * refreshing already couldn't fix). This does not change 5xx/network-error
 * behavior, which still benefits from a bounded retry. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry },
    mutations: { retry: false },
  },
});
