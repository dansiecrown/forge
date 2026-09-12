import type { ReactNode } from 'react';
import { cn } from '@/utils';

export interface DefinitionItem {
  label: string;
  value: ReactNode;
}

/** The read-only counterpart to a detail page's edit form — every
 * Organization/Academy/Fellowship/Cohort/Profile "Profile" card shows this
 * by default; the form itself only appears inside the Edit dialog. Matches
 * the `dt`/`dd` visual language the Statistics card already established. */
export function DefinitionList({
  items,
  columns = 2,
}: {
  items: DefinitionItem[];
  columns?: 2 | 3;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-4 text-sm',
        columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
