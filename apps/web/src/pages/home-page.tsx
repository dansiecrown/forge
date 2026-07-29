import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useSession } from '@/contexts/session-context';
import { useSignOut } from '@/hooks/use-sign-out';

export function HomePage() {
  const { user, memberships } = useSession();
  const signOut = useSignOut();
  const { activeOrganizationId } = useActiveOrganization();

  // Role-aware landing: a STUDENT-only membership in the active organization
  // goes straight to the student portal, a MENTOR-only membership to the
  // mentor portal. Everyone else (any other staff role present) keeps the
  // existing stub — no general RBAC route-guard system, this is the entire
  // scope of the redirect (Milestone 5, extended in Milestone 6).
  const activeMembership = memberships.find((m) => m.organizationId === activeOrganizationId);
  if (
    activeMembership &&
    activeMembership.roles.length === 1 &&
    activeMembership.roles[0] === 'STUDENT'
  ) {
    return <Navigate to="/portal" replace />;
  }
  if (
    activeMembership &&
    activeMembership.roles.length === 1 &&
    activeMembership.roles[0] === 'MENTOR'
  ) {
    return <Navigate to="/mentor" replace />;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <section className="max-w-md space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Project Forge
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Signed in as {user?.displayName}
        </h1>
        <p className="text-muted-foreground">
          The identity and access-control foundation is running. Product dashboards are
          intentionally deferred.
        </p>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </section>
    </main>
  );
}
