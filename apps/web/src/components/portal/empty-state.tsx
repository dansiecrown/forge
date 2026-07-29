import type { ReactNode } from 'react';

/** Shared empty-state surface for the student portal's list pages — mirrors
 * `DataTable`'s built-in empty state visually, for the pages here that use
 * card grids instead of tables. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}
