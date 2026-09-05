import { cn } from '@/utils';

export interface ProgressRingProps {
  /** 0-100. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

/** Plain SVG progress indicator — no charting library (Milestone 5 keeps
 * the "no new dependency" constraint for visual progress indicators). Used
 * at a large size on the Dashboard and a small size per-module on the
 * Progress Center. */
export function ProgressRing({
  percent,
  size = 96,
  strokeWidth = 8,
  label,
  className,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={label ?? `${clamped}% complete`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-brand transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-lg font-semibold tabular-nums text-foreground">
        {clamped}%
      </span>
    </div>
  );
}
