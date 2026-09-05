import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface EntityOption<T> {
  id: string;
  label: string;
  sublabel?: string;
  raw: T;
}

interface EntitySearchFieldProps<T> {
  label: string;
  placeholder?: string;
  /** The currently-resolved item, once one has been picked from the
   * suggestion list. While set, the search input is replaced with a summary
   * chip — never a bare id. */
  selected: EntityOption<T> | null;
  onSelect: (item: T) => void;
  onClear: () => void;
  /** Resolves a query string to suggestions — callers own how (and against
   * which endpoint) matching happens; this component only owns the
   * search-as-you-type UI. */
  search: (query: string) => Promise<EntityOption<T>[]>;
  queryKey: unknown[];
  minQueryLength?: number;
  error?: string;
  disabled?: boolean;
}

/** Type-to-search-by-name replacement for a raw id field — the generic
 * form of `PersonSearchField` (which now composes this), usable for any
 * resource (Organization/Academy/Fellowship/Cohort/Role/User/…). The
 * caller decides what a match looks like and what `onSelect` receives; this
 * component only ever shows a name/sublabel, never an id, and only ever
 * hands back the resolved item. */
export function EntitySearchField<T>({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
  search,
  queryKey,
  minQueryLength = 2,
  error,
  disabled,
}: EntitySearchFieldProps<T>) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const searchEnabled = trimmed.length >= minQueryLength && !selected;

  const results = useQuery({
    queryKey: [...queryKey, trimmed],
    queryFn: () => search(trimmed),
    enabled: searchEnabled,
  });
  const options = results.data ?? [];

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface-2 px-3 py-2 text-sm">
        <div className="truncate">
          <span className="font-medium text-foreground">{selected.label}</span>
          {selected.sublabel ? (
            <span className="text-muted-foreground"> {selected.sublabel}</span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={onClear}
          disabled={disabled}
          className="shrink-0 text-muted-foreground transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        aria-label={label}
        placeholder={placeholder ?? 'Search by name…'}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-autocomplete="list"
        aria-expanded={trimmed.length >= minQueryLength}
        role="combobox"
        disabled={disabled}
        autoComplete="off"
      />
      {trimmed.length >= minQueryLength ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-card border border-border bg-surface shadow-subtle">
          {results.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Searching…
            </div>
          ) : options.length > 0 ? (
            <ul role="listbox" className="max-h-56 overflow-y-auto">
              {options.map((option) => (
                <li key={option.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(option.raw);
                      setQuery('');
                    }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="font-medium text-foreground">{option.label}</span>
                    {option.sublabel ? (
                      <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
