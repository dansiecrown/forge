import { cn } from '@/utils';

/** A locked-in value shown in the same inset-label box as `FormField`/
 * `SelectField` — used when a parent is already known from navigation
 * context (e.g. "Academy" when creating a fellowship from that academy's
 * own page) and shouldn't be re-picked from a dropdown. */
export function ReadOnlyField({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn(fullWidth ? 'w-full' : 'w-full sm:min-w-56 sm:flex-[1_1_18rem]')}>
      <div className="rounded-control border border-border bg-surface-2 px-3 pb-2 pt-1.5">
        <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
        <p className="mt-0.5 truncate text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}
