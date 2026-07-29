import type { ReactNode } from 'react';
import { cn } from '@/utils';

export interface TimelineItem {
  id: string;
  icon: ReactNode;
  title: string;
  meta: string;
}

/** CSS-only vertical timeline (border + absolutely-positioned dots) — no
 * SVG, no charting library. Used by the Progress Center's activity feed. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ol className="space-y-0">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
          {index < items.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
            />
          ) : null}
          <span
            className={cn(
              'z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground',
            )}
          >
            {item.icon}
          </span>
          <div className="pt-1">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.meta}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
