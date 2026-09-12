import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils';

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  /** Spans the full row instead of flowing alongside its siblings — for a
   * field whose content genuinely wants the width (Description, Summary,
   * Note), inside a `flex flex-wrap` form. Every other field defaults to an
   * intrinsic, wrappable width so a form of several short fields reads as a
   * flow, not a single column of full-width rows stacked to the floor.
   * Meaningless outside a `flex flex-wrap` parent — see the note on the
   * default sizing below. */
  fullWidth?: boolean;
}

/** A bordered "box" with its label inset as a small caption at the top and
 * the value directly beneath it, borderless, in the same box — one visual
 * unit instead of a label floating above a separate input. Meant to be laid
 * out inside a `<form className="flex flex-wrap gap-4">`, not `space-y-*`:
 * see e.g. `academy-detail-page.tsx`'s Profile card.
 *
 * The default sizing (`sm:flex-[1_1_18rem]`) is a `flex-basis`/grow/shrink
 * shorthand, not a `max-width` — flex sizing properties are no-ops on
 * anything that isn't a flex item, so this same default is inert (and
 * harmless) inside a plain stacked `space-y-*` form: it just falls back to
 * `w-full`, filling the same width as everything else in that form. A
 * `max-width` here previously capped every field at a fixed pixel width
 * even in stacked forms (sign-in, forgot/reset password) regardless of how
 * wide their container actually was — a real, shipped regression this
 * replaces. */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, name, error, fullWidth, className, disabled, ...inputProps }, ref) => {
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
          <input
            ref={ref}
            id={name}
            name={name}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'mt-0.5 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none',
              className,
            )}
            {...inputProps}
          />
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
FormField.displayName = 'FormField';
