import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
  {
    variants: {
      variant: {
        primary: 'bg-foreground text-background hover:opacity-90',
        secondary: 'border border-border bg-surface-2 text-foreground hover:bg-border/40',
        tertiary: 'text-brand underline-offset-4 hover:underline',
        destructive: 'bg-danger-solid text-white hover:opacity-90',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
