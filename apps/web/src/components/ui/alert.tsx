import { type HTMLAttributes, forwardRef } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'danger' | 'success';
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'danger', children, ...props }, ref) => {
    const Icon = variant === 'success' ? CheckCircle2 : AlertCircle;
    return (
      <div
        ref={ref}
        role={variant === 'danger' ? 'alert' : 'status'}
        className={cn(
          'flex items-start gap-2 rounded-control border px-3 py-2 text-sm',
          variant === 'danger' && 'border-danger/30 bg-danger/5 text-danger',
          variant === 'success' && 'border-success/30 bg-success/5 text-success',
          className,
        )}
        {...props}
      >
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>{children}</div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';
