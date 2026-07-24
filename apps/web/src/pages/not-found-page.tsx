import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <div className="max-w-sm space-y-4 text-center">
        <Compass className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          This page doesn&apos;t exist
        </h1>
        <p className="text-muted-foreground">
          Check the address, or head back to somewhere familiar.
        </p>
        <Link to="/" className={buttonVariants({ variant: 'primary' })}>
          Go to home
        </Link>
      </div>
    </main>
  );
}
