import type { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-sm font-medium text-muted-foreground">PROJECT FORGE</p>
        {children}
      </div>
    </main>
  );
}
