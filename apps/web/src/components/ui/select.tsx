import { type SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

/** `appearance-none` strips each browser's own (visually inconsistent,
 * unthemeable) trigger chrome and native arrow glyph; the `ChevronDown`
 * below replaces it with one that actually matches the design system in
 * both themes. The open option list itself is still browser/OS-rendered —
 * no CSS can restyle that popup's internals across browsers today — so
 * this is deliberately scoped to what's actually reskinnable. Anywhere
 * picking from a long list would benefit from real search/suggestions
 * instead (Academy/Fellowship/Cohort/User pickers) uses the fully custom
 * `EntitySearchField` instead of this component. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn('relative w-full', className)}>
      <select
        ref={ref}
        className="flex h-11 w-full appearance-none rounded-control border border-border bg-surface-2 px-3 pr-9 text-sm text-foreground transition-colors duration-150 ease-out hover:border-muted-foreground/50 focus:border-brand focus:hover:border-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  ),
);
Select.displayName = 'Select';
