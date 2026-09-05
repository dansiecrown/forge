import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils';

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  error?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, name, error, className, ...textareaProps }, ref) => {
    const errorId = `${name}-error`;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name}>{label}</Label>
        <Textarea
          ref={ref}
          id={name}
          name={name}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(className)}
          {...textareaProps}
        />
        {error ? (
          <p id={errorId} className="text-sm text-danger" aria-live="polite">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
TextareaField.displayName = 'TextareaField';
