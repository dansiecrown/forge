import { type HTMLAttributes, forwardRef } from 'react';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/utils';

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Defaults to h1 — every current page renders exactly one Card. Set
   * explicitly once a page renders more than one Card (e.g. a dashboard)
   * so the page keeps a single h1 in its heading hierarchy. */
  as?: 'h1' | 'h2' | 'h3';
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Reserved for the auth card and other approved floating surfaces —
   * never the default for generic content cards. */
  glass?: boolean;
  /** Stagger, in ms, for cards that reveal together (e.g. a same-row grid) —
   * so they don't all fade in in perfect unison. Purely cosmetic; omit for
   * cards that reveal on their own. */
  revealDelayMs?: number;
}

/** Fades and lifts into place each time it's actually scrolled into view —
 * see `useScrollReveal` — rather than once at mount, so a card scrolled
 * past and back into view replays the reveal instead of just sitting there
 * already-visible. Respects `prefers-reduced-motion` via the existing
 * global transition-duration override in globals.css. */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glass, revealDelayMs = 0, style, ...props }, forwardedRef) => {
    const { ref: revealRef, visible } = useScrollReveal<HTMLDivElement>();

    return (
      <div
        ref={(node) => {
          revealRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        style={{ transitionDelay: visible ? `${revealDelayMs}ms` : '0ms', ...style }}
        className={cn(
          'rounded-card p-8 transition-all duration-500 ease-out',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
          glass ? 'glass-panel' : 'border border-border bg-surface shadow-subtle',
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-6 space-y-1.5', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Heading = 'h1', ...props }, ref) => (
    <Heading
      ref={ref}
      className={cn(
        'text-2xl font-semibold leading-tight tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-5', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-6 flex items-center justify-between', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';
