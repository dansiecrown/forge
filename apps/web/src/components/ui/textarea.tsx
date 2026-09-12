import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-24 w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 ease-out hover:border-muted-foreground/50 focus:border-brand focus:hover:border-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border',
      'aria-[invalid=true]:border-danger',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
