import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="max-w-sm space-y-4 text-center">
        <ShieldAlert className="mx-auto size-10 text-warning" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          You don&apos;t have access to this page
        </h1>
        <p className="text-muted-foreground">
          If you believe this is a mistake, contact an administrator in your organization.
        </p>
        <Link to="/" className={buttonVariants({ variant: 'primary' })}>
          Go to home
        </Link>
      </div>
    </main>
  );
}
