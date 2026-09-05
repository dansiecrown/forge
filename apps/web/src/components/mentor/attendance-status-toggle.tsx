import type { HuddleAttendanceStatus } from '@forge/api-contract';
import { cn } from '@/utils';

const OPTIONS: { value: HuddleAttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
];

export function AttendanceStatusToggle({
  value,
  onChange,
  disabled,
}: {
  value: HuddleAttendanceStatus;
  onChange: (status: HuddleAttendanceStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Attendance status"
      className="inline-flex rounded-control border border-border bg-surface-2 p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-control px-2.5 py-1 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
            value === option.value
              ? 'bg-surface text-foreground shadow-subtle'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
