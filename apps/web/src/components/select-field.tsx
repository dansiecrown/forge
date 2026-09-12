import { type ReactNode, type SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: string;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

/** The `<select>` counterpart to `FormField` — same inset-label box, same
 * flow-friendly default width (see `FormField`'s own doc comment for why
 * it's a `flex-basis` shorthand, not a `max-width` — the latter broke every
 * non-flex-wrap consumer of this sizing). */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, name, error, fullWidth, className, disabled, children, ...selectProps }, ref) => {
    const errorId = `${name}-error`;
    return (
      <div className={cn(fullWidth ? 'w-full' : 'w-full sm:min-w-56 sm:flex-[1_1_18rem]')}>
        <div
          className={cn(
            'rounded-control border border-border bg-surface-2 px-3 pb-2 pt-1.5 transition-colors duration-150 ease-out',
            'hover:border-muted-foreground/50 focus-within:border-brand focus-within:hover:border-brand',
            error && 'border-danger hover:border-danger',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <label htmlFor={name} className="block text-[11px] font-medium text-muted-foreground">
            {label}
          </label>
          <div className="relative">
            <select
              ref={ref}
              id={name}
              name={name}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                'mt-0.5 w-full appearance-none bg-transparent pr-6 text-sm text-foreground focus:outline-none',
                className,
              )}
              {...selectProps}
            >
              {children}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0 top-1/2 mt-0.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-sm text-danger" aria-live="polite">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
SelectField.displayName = 'SelectField';
