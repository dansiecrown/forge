import { listAdminUsers, type AdminUser } from '@/features/admin-users/api/admin-users-api';
import { useActiveOrganization } from '@/contexts/organization-context';
import { EntitySearchField, type EntityOption } from './entity-search-field';

interface PersonSearchFieldProps {
  label: string;
  placeholder?: string;
  selected: AdminUser | null;
  onSelect: (user: AdminUser) => void;
  onClear: () => void;
  error?: string;
  disabled?: boolean;
}

function toOption(user: AdminUser): EntityOption<AdminUser> {
  return { id: user.id, label: user.displayName, sublabel: user.emailCanonical, raw: user };
}

/** Type-to-search-by-name-or-email replacement for a raw id field, backed by
 * the existing people directory (`GET /admin/users?q=`, `user.read`). Thin
 * wrapper over the generic `EntitySearchField` — the caller decides what to
 * do with the resolved `AdminUser`; some targets (e.g. a cohort enrollment)
 * want its `id` directly, others (e.g. a cohort mentor assignment) need a
 * further hop to that user's membership id, so this component only ever
 * hands back the resolved person, never an id shape of its own. */
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

  return (
    <EntitySearchField
      label={label}
      placeholder={placeholder ?? 'Search by name or email…'}
      selected={selected ? toOption(selected) : null}
      onSelect={onSelect}
      onClear={onClear}
      error={error}
      disabled={disabled || !activeOrganizationId}
      queryKey={['person-search', activeOrganizationId]}
      search={(query) =>
        listAdminUsers(query, undefined, activeOrganizationId).then((page) =>
          page.items.map(toOption),
        )
      }
    />
  );
}
