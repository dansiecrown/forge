import type { HTMLAttributes } from 'react';
import { cn } from '@/utils';

/** A single pulsing placeholder block. Compose several into the actual shape
 * of what's loading (a KPI tile, a chart, a list row) rather than one generic
 * box — see each dashboard's own `*Skeleton` component. Respects
 * `prefers-reduced-motion` via the existing global override in globals.css
 * (`animate-pulse` is a Tailwind animation, covered by the same rule that
 * already neutralizes `Card`'s reveal animation). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-control bg-surface-2', className)}
      {...props}
    />
  );
}
