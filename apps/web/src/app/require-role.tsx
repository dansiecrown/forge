import { Loader2 } from 'lucide-react';
import { Navigate, Outlet } from 'react-router-dom';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useSession } from '@/contexts/session-context';

/** Closes a real existing gap: `/admin` previously had zero role-based UI
 * gating, only `ProtectedRoute`'s auth-gating. Reads
 * `useSession().memberships[...].roles` (already present in `MeResponse`,
 * previously unused by any frontend gate). Redirects to `/unauthorized`
 * rather than hiding the route entirely, matching this app's existing
 * "cross-tenant read is not-found/unauthorized, not a blank screen"
 * posture.
 *
 * `activeOrganizationId` is resolved by `OrganizationProvider` in a
 * `useEffect` keyed on `memberships`, so on the very first render after
 * `memberships` populates it is still `undefined` for one pass — a real,
 * live-verified race: treating that transient state as "no role" fired an
 * immediate `replace` navigation to `/unauthorized` that stuck even though
 * the next render resolved the correct organization and role. Waiting for
 * `memberships` to be non-empty (once loaded, a real membership set is
 * never emptied back to `[]` while authenticated) before deciding avoids
 * deciding on stale/incomplete data. */
export function RequireRole({ roles }: { roles: string[] }) {
  const { memberships } = useSession();
  const { activeOrganizationId } = useActiveOrganization();

  if (memberships.length > 0 && activeOrganizationId === undefined) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  const activeMembership = memberships.find(
    (membership) => membership.organizationId === activeOrganizationId,
  );
  const hasRole = activeMembership?.roles.some((role) => roles.includes(role)) ?? false;

  if (!hasRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
