import { type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-control border border-border bg-surface-2 px-3 text-sm text-foreground transition-colors duration-150 ease-out focus:border-brand disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
