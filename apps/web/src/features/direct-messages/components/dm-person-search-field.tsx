import type { PersonSearchResult } from '@forge/api-contract';
import { EntitySearchField, type EntityOption } from '@/components/admin/entity-search-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import { searchPeople } from '../api/direct-messages-api';

function toOption(person: PersonSearchResult): EntityOption<PersonSearchResult> {
  return {
    id: person.id,
    label: person.displayName,
    sublabel: person.username ? `@${person.username}` : undefined,
    raw: person,
  };
}

/** Who to DM — searches every *active member of the caller's own
 * organization* (`GET /me/people/search`), by display name or username.
 * Deliberately not `PersonSearchField` (the admin `user.read`-gated
 * directory) — every role can use this one, not just admins. */
export function DmPersonSearchField({
  selected,
  onSelect,
  onClear,
}: {
  selected: PersonSearchResult | null;
  onSelect: (person: PersonSearchResult) => void;
  onClear: () => void;
}) {
  const { activeOrganizationId } = useActiveOrganization();

  return (
    <EntitySearchField
      label="To"
      placeholder="Search by name or username…"
      selected={selected ? toOption(selected) : null}
      onSelect={onSelect}
      onClear={onClear}
      queryKey={['direct-messages', 'people-search', activeOrganizationId]}
      search={async (query) => (await searchPeople(query, activeOrganizationId)).map(toOption)}
    />
  );
}
