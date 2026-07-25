import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export interface StatusFilterOption {
  value: string;
  label: string;
}

/** Search box + optional status filter, shared by every Milestone 3 admin
 * list page. Controlled — the page owns `q`/`status` state and refetches via
 * its react-query key. */
export function ListToolbar({
  q,
  onQChange,
  status,
  onStatusChange,
  statusOptions,
  searchPlaceholder = 'Search…',
}: {
  q: string;
  onQChange: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: StatusFilterOption[];
  searchPlaceholder?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={q}
          onChange={(event) => onQChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
          aria-label="Search"
        />
      </div>
      {statusOptions && onStatusChange ? (
        <Select
          value={status ?? ''}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label="Filter by status"
          className="w-auto min-w-[160px]"
        >
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
