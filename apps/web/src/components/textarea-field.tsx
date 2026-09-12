import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils';

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  error?: string;
}

/** The multi-line counterpart to `FormField` — same inset-label box. Always
 * spans the full row of a `flex flex-wrap` form (a textarea's whole point is
 * the extra width/height a flowed short field wouldn't give it). */
export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, name, error, className, disabled, ...textareaProps }, ref) => {
    const errorId = `${name}-error`;
    return (
      <div className="w-full">
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
          <textarea
            ref={ref}
            id={name}
            name={name}
            disabled={disabled}
            rows={3}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'mt-0.5 w-full resize-y bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none',
              className,
            )}
            {...textareaProps}
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
TextareaField.displayName = 'TextareaField';
