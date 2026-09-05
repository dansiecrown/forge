import { Loader2 } from 'lucide-react';

/** Suspense fallback for the lazy-loaded `/portal` route tree. */
export function PortalRouteSkeleton() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
