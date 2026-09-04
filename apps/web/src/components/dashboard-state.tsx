import { createContext, useContext, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'loading' | 'error' | 'empty' | 'success';

const StatusContext = createContext<Status | null>(null);

function useStatus(componentName: string): Status {
  const status = useContext(StatusContext);
  if (status === null) {
    throw new Error(`${componentName} must be rendered inside <DashboardState>.`);
  }
  return status;
}

/** Compound 4-state wrapper for a dashboard page — see
 * docs/adr/0013-dashboard-bento-redesign.md. Renders whichever child slot
 * matches `status`; every dashboard computes its own status the same way:
 * `isLoading ? 'loading' : error ? 'error' : isEmptyCondition ? 'empty' : 'success'`.
 * Replaces three near-identical hand-rolled if/else blocks (one per
 * dashboard) with one shared, consistent shape. */
export function DashboardState({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <div aria-live="polite" aria-busy={status === 'loading'}>
      <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
    </div>
  );
}

DashboardState.Loading = function Loading({ children }: { children: ReactNode }) {
  return useStatus('DashboardState.Loading') === 'loading' ? <>{children}</> : null;
};

DashboardState.Error = function ErrorSlot({ children }: { children: ReactNode }) {
  return useStatus('DashboardState.Error') === 'error' ? <>{children}</> : null;
};

DashboardState.Empty = function Empty({ children }: { children: ReactNode }) {
  return useStatus('DashboardState.Empty') === 'empty' ? <>{children}</> : null;
};

DashboardState.Content = function Content({ children }: { children: ReactNode }) {
  return useStatus('DashboardState.Content') === 'success' ? <>{children}</> : null;
};

/** The shared visual for the Error slot — distinct from Empty (nothing went
 * wrong, there's just nothing there yet) rather than collapsing both into
 * one "couldn't load" message the way these pages did before. Always offers
 * a retry, since every dashboard's data comes from one refetchable query. */
export function DashboardErrorPanel({
  description = 'Please try again.',
  onRetry,
}: {
  description?: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-card border border-danger/25 bg-danger/5 px-6 py-10 text-center"
    >
      <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-foreground">We couldn't load your dashboard.</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
