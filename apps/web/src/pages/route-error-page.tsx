import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

/** Root-level `errorElement` for the router (Milestone 8 production
 * hardening) — without one, an uncaught error thrown while rendering any
 * route (a bad API response shape, a null a feature forgot to guard
 * against) unmounts the whole React tree and leaves a blank white screen,
 * the exact "no recovery UI" failure mode this exists to prevent. A route
 * loader/action error reaches here too (`isRouteErrorResponse`), though
 * this app doesn't currently use router loaders/actions. This is
 * deliberately one shared boundary for the whole app, not a redesign of
 * individual routes' own loading/error/empty states, which already exist
 * per-feature. */
export function RouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <div className="max-w-sm space-y-4 text-center">
        <AlertTriangle className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {status ? `Something went wrong (${status})` : 'Something went wrong'}
        </h1>
        <p className="text-muted-foreground">
          This page ran into an unexpected error. Try reloading, or head back to somewhere familiar.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={buttonVariants({ variant: 'secondary' })}
          >
            Reload
          </button>
          <Link to="/" className={buttonVariants({ variant: 'primary' })}>
            Go to home
          </Link>
        </div>
      </div>
    </main>
  );
}
