// Plain SVG bar chart — no charting library, same "no new dependency"
// precedent apps/web/src/components/portal/progress-ring.tsx already
// established (Milestone 5/7's "simple charts only" constraint).

export interface BarChartDatum {
  label: string;
  value: number;
}

const SERIES_TONES = ['stroke-brand fill-brand', 'fill-success', 'fill-warning', 'fill-danger'];

export function BarChart({
  data,
  height = 160,
  className,
}: {
  data: BarChartDatum[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = data.length > 0 ? 100 / data.length : 0;

  return (
    <div className={className}>
      <svg
        role="img"
        aria-label="Bar chart"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full overflow-visible"
      >
        {data.map((d, index) => {
          const barHeight = max === 0 ? 0 : (d.value / max) * (height - 20);
          const x = index * barWidth;
          return (
            <g key={d.label}>
              <rect
                x={x + barWidth * 0.15}
                y={height - 20 - barHeight}
                width={barWidth * 0.7}
                height={barHeight}
                rx={1.5}
                className={`${SERIES_TONES[index % SERIES_TONES.length]} transition-[height,y] duration-500 ease-out`}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex text-xs text-muted-foreground">
        {data.map((d) => (
          <div key={d.label} style={{ width: `${barWidth}%` }} className="truncate text-center">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
