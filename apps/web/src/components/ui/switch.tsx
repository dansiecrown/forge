import { cn } from '@/utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Minimal toggle-preference switch — Settings -> Notifications' rows are
 * the first place a "toggle" pattern is common enough to warrant one
 * reusable component rather than repeated ad hoc checkboxes. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-foreground' : 'bg-surface-2 border border-border',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-background shadow-subtle transition-transform duration-150',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
