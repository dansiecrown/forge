import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading: boolean;
  error?: Error | null;
  emptyTitle: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}

/** Shared list surface for every Milestone 3 admin page (Organizations,
 * Academies, Fellowships, Cohorts) — search/filter controls are composed
 * around this by each page; this owns the table body's loading, error and
 * empty states so they stay consistent. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  emptyTitle,
  emptyDescription,
  onRowClick,
}: DataTableProps<T>) {
  if (error) {
    return (
      <Alert variant="danger" role="alert">
        {error.message || 'Something went wrong. Please try again.'}
      </Alert>
    );
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-card border border-border bg-surface">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-card border border-border bg-surface px-6 text-center">
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        {emptyDescription ? (
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn('px-4 py-3', column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-border last:border-0',
                onRowClick && 'cursor-pointer hover:bg-surface-2',
              )}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
