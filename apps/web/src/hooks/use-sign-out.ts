import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/session-context';

/** Explicit "Sign out" always lands on a clean `/sign-in` with no `from`
 * state — unlike `ProtectedRoute`'s own redirect-on-session-expiry (which
 * deliberately carries `from`, to return the caller to what they were
 * viewing once they re-authenticate). Those are different situations: an
 * intentional sign-out should never carry the previous session's location
 * forward, especially since a different person may sign in next on the
 * same device/tab — without this, they'd land back on the previous
 * session's last page instead of the correct role-aware landing route.
 *
 * Navigates away *before* clearing the session, not after — clearing the
 * session first would flip `status` to `'unauthenticated'` while the
 * caller is still mounted under `ProtectedRoute`, which reacts to that
 * itself with its own `state.from`-carrying redirect. That redirect and
 * this hook's own `navigate` call would then race, and the two have been
 * observed to resolve in either order. Navigating to the public `/sign-in`
 * route first unmounts `ProtectedRoute` immediately, so it never gets a
 * chance to fire — there is no race left to lose. */
export function useSignOut() {
  const { logout } = useSession();
  const navigate = useNavigate();
  return async () => {
    navigate('/sign-in', { replace: true });
    await logout();
  };
}
