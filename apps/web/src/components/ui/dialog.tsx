import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils';
import { Alert } from './alert';
import { Button, type ButtonProps } from './button';
import { Input } from './input';
import { Label } from './label';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** The one floating-surface primitive the design system anticipated but
 * never built (`.glass-panel` has been ready since
 * docs/adr/0004-premium-dark-design-system.md, "for whoever builds them").
 * Traps focus, restores it to the trigger on close, and closes on Escape or
 * backdrop click — docs/product-design-specification.md §8: "Dialogs trap
 * focus, return focus on close, close with Escape, and announce their
 * title/purpose." Rendered via a portal so it always sits above page
 * layout regardless of any ancestor's stacking/overflow context. */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? panel)?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-canvas/70" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'glass-panel animate-card-in relative w-full max-w-md rounded-modal p-6 outline-none',
          className,
        )}
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-1.5 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: ButtonProps['variant'];
  loading?: boolean;
  error?: string | null;
  /** When set, the dialog collects a free-text reason before confirming —
   * for actions whose API already records one (organization/academy
   * suspend/archive, cohort application reject). Omit for a plain yes/no
   * confirmation. */
  reasonLabel?: string;
  /** Whether the reason must be non-empty before Confirm enables. Defaults
   * to true; set false for an optional reason (e.g. cohort application
   * reject, where the API accepts an undefined reason). */
  reasonRequired?: boolean;
}

/** The named-confirmation pattern `docs/product-design-specification.md` §3
 * requires for every destructive action ("destructive actions require a
 * named confirmation") — built once, on top of `Dialog`, so it replaces the
 * several hand-rolled inline copies of this same pattern and gives it to
 * actions that had none at all. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'destructive',
  loading = false,
  error,
  reasonLabel,
  reasonRequired = true,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const reasonId = useId();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const canConfirm = !reasonLabel || !reasonRequired || reason.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canConfirm) return;
          void onConfirm(reasonLabel ? reason.trim() : undefined);
        }}
      >
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {reasonLabel ? (
          <div className="space-y-1.5">
            <Label htmlFor={reasonId}>{reasonLabel}</Label>
            <Input
              id={reasonId}
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant={confirmVariant} loading={loading} disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
