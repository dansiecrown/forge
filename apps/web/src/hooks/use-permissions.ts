import { useQuery } from '@tanstack/react-query';
import { fetchMyPermissions } from '@/features/identity';
import { useActiveOrganization } from '@/contexts/organization-context';

/** Resolves the caller's real permission set for the active organization via
 * `GET /me/permissions` — the same `PermissionResolverService` the backend
 * guard uses, not a hand-maintained frontend copy of the grant table that
 * could drift out of sync. Powers nav/action-button visibility so a role
 * only sees controls it can actually use (e.g. an Academy Admin, who lacks
 * `audit.read`/`organization.list`, doesn't see "Audit"/"Organizations" —
 * previously every admin role saw the identical nav regardless of what
 * they could do, which is the bug this hook fixes). */
export function usePermissions() {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['me', 'permissions', activeOrganizationId],
    queryFn: () => fetchMyPermissions(activeOrganizationId as string),
    enabled: Boolean(activeOrganizationId),
    staleTime: 60_000,
  });

  const permissionKeys = new Set(query.data?.permissionKeys ?? []);
  const isSuperAdmin = query.data?.isSuperAdmin ?? false;

  function has(permissionKey: string): boolean {
    return isSuperAdmin || permissionKeys.has(permissionKey);
  }

  function hasAny(...keys: string[]): boolean {
    return isSuperAdmin || keys.some((key) => has(key));
  }

  return { has, hasAny, isSuperAdmin, isLoading: query.isLoading };
}
