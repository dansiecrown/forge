import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/session-context';

export function HomePage() {
  const { user, logout } = useSession();

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
        <Button variant="secondary" onClick={() => void logout()}>
          Sign out
        </Button>
      </section>
    </main>
  );
}
