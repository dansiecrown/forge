import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

export interface ActionsMenuItem {
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

/** Compact popover replacement for a full-width "Lifecycle" card of plain
 * action buttons — the same glass-panel floating-surface pattern already
 * proven by `NotificationPanel`, generalized and given the outside-click/
 * Escape handling that pattern was missing. Confirmation for destructive
 * items still happens in a `ConfirmDialog` triggered from `onSelect` — this
 * only replaces the always-visible button row, not the confirmation step. */
export function ActionsMenu({
  items,
  label = 'Actions',
}: {
  items: ActionsMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
        <ChevronDown
          className={cn('size-4 transition-transform duration-150', open && 'rotate-180')}
          aria-hidden="true"
        />
      </Button>
      {open ? (
        <div
          role="menu"
          className="glass-panel absolute right-0 top-full z-20 mt-2 w-56 rounded-card p-1.5"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled || item.loading}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50',
                item.tone === 'danger' ? 'text-danger' : 'text-foreground',
              )}
            >
              {item.label}
              {item.loading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
