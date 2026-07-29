import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/utils';

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Minimal tab bar — no primitive like this existed anywhere in the design
 * system before Settings needed one. `role="tablist"` + left/right
 * arrow-key navigation, styled like the existing `NavLink` active-state
 * pattern used in `AdminLayout`/`PortalLayout`. Purely a tab *switcher* —
 * the caller renders the corresponding panel. */
export function Tabs({ items, value, onChange, className }: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;
    onChange(items[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}
    >
      {items.map((item, index) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
