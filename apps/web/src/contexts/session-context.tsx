import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LoginResponse, MeResponse, PublicUser } from '@forge/api-contract';
import { configureApiClient } from '@/api/client';
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  verifyMfa,
} from '@/features/identity';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type SessionMembership = MeResponse['memberships'][number];

interface SessionContextValue {
  status: SessionStatus;
  user: PublicUser | null;
  /** Retained from `GET /me` for the organization switcher — see
   * contexts/organization-context.tsx, which derives the caller's active
   * organization from this list. */
  memberships: SessionMembership[];
  login: (email: string, password: string) => Promise<LoginResponse>;
  completeMfaLogin: (challengeToken: string, code: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function toPublicUser(me: MeResponse): PublicUser {
  return { id: me.id, displayName: me.displayName, email: me.email, status: me.status };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const accessTokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [memberships, setMemberships] = useState<SessionMembership[]>([]);

  const applySuccessfulLogin = useCallback(
    (response: Extract<LoginResponse, { mfaRequired: false }>) => {
      accessTokenRef.current = response.accessToken;
      setUser(response.user);
      setStatus('authenticated');
      // The login response doesn't carry memberships (docs/api-specification.md
      // §4.1) — fetch them once so the organization switcher has data.
      void fetchMe()
        .then((me) => setMemberships(me.memberships))
        .catch(() => setMemberships([]));
    },
    [],
  );

  const clearSession = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
    setMemberships([]);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessTokenRef.current,
      refreshAccessToken: async () => {
        try {
          const result = await refreshSession();
          accessTokenRef.current = result.accessToken;
          return result.accessToken;
        } catch {
          return null;
        }
      },
      onSessionExpired: clearSession,
    });
  }, [clearSession]);

  // Caches the in-flight `refreshSession()` call across React 18/19
  // StrictMode's intentional double-invocation of effects in development.
  // Without this, two concurrent `refreshSession()` calls fire on mount,
  // both carrying the same refresh-token cookie: the first rotates it
  // successfully, the second then presents an already-rotated token, which
  // the server's reuse detection correctly (but here, falsely) flags as
  // theft and revokes the whole session. A plain "only run once" boolean
  // guard does NOT work here: StrictMode's first invocation is cleaned up
  // (its own `cancelled` flag flips true) before the second invocation
  // runs, so skipping the second invocation's call entirely would leave the
  // successful result applied only by the already-cancelled first instance
  // — permanently stuck on `status: 'loading'`. Sharing the promise instead
  // lets both invocations await the same network call while each still
  // independently — and correctly — governs whether it applies the result.
  const restoreSessionPromiseRef = useRef<ReturnType<typeof refreshSession> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        if (!restoreSessionPromiseRef.current) {
          const promise = refreshSession();
          restoreSessionPromiseRef.current = promise;
          void promise.finally(() => {
            if (restoreSessionPromiseRef.current === promise) {
              restoreSessionPromiseRef.current = null;
            }
          });
        }
        const result = await restoreSessionPromiseRef.current;
        accessTokenRef.current = result.accessToken;
        const me = await fetchMe();
        if (!cancelled) {
          setUser(toPublicUser(me));
          setMemberships(me.memberships);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          setStatus('unauthenticated');
        }
      }
    }
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginRequest({ email, password });
      if (!response.mfaRequired) {
        applySuccessfulLogin(response);
      }
      return response;
    },
    [applySuccessfulLogin],
  );

  const completeMfaLogin = useCallback(
    async (challengeToken: string, code: string) => {
      const response = await verifyMfa({ code }, challengeToken);
      if (!response.mfaRequired) {
        applySuccessfulLogin(response);
      }
      return response;
    },
    [applySuccessfulLogin],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, memberships, login, completeMfaLogin, logout }),
    [status, user, memberships, login, completeMfaLogin, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
