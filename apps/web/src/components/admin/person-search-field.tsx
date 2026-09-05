import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { listAdminUsers, type AdminUser } from '@/features/admin-users/api/admin-users-api';
import { useActiveOrganization } from '@/contexts/organization-context';
import { Input } from '@/components/ui/input';

interface PersonSearchFieldProps {
  label: string;
  placeholder?: string;
  /** The currently-resolved person, once one has been picked from the
   * dropdown. While set, the search input is replaced with a summary chip. */
  selected: AdminUser | null;
  onSelect: (user: AdminUser) => void;
  onClear: () => void;
  error?: string;
  disabled?: boolean;
}

/** Type-to-search-by-name-or-email replacement for a raw id field, backed by
 * the existing people directory (`GET /admin/users?q=`, `user.read`). The
 * caller decides what to do with the resolved `AdminUser` — some targets
 * (e.g. a cohort enrollment) want its `id` directly, others (e.g. a cohort
 * mentor assignment) need a further hop to that user's membership id, so
 * this component only ever hands back the resolved person, never an id
 * shape of its own. */
export function PersonSearchField({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
  error,
  disabled,
}: PersonSearchFieldProps) {
  const { activeOrganizationId } = useActiveOrganization();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const searchEnabled = Boolean(activeOrganizationId) && trimmed.length >= 2 && !selected;

  const search = useQuery({
    queryKey: ['person-search', trimmed, activeOrganizationId],
    queryFn: () => listAdminUsers(trimmed, undefined, activeOrganizationId),
    enabled: searchEnabled,
  });
  const results = search.data?.items ?? [];

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface-2 px-3 py-2 text-sm">
        <div className="truncate">
          <span className="font-medium text-foreground">{selected.displayName}</span>{' '}
          <span className="text-muted-foreground">{selected.emailCanonical}</span>
        </div>
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={onClear}
          disabled={disabled}
          className="shrink-0 text-muted-foreground transition-colors hover:text-danger"
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
        placeholder={placeholder ?? 'Search by name or email…'}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        autoComplete="off"
      />
      {trimmed.length >= 2 ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-card border border-border bg-surface shadow-subtle">
          {search.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Searching…
            </div>
          ) : results.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(user);
                      setQuery('');
                    }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="font-medium text-foreground">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">{user.emailCanonical}</span>
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
