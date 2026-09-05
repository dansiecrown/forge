import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { PersonSearchField } from '@/components/admin/person-search-field';
import { Input } from '@/components/ui/input';
import { useActiveOrganization } from '@/contexts/organization-context';
import type { AdminUser } from '@/features/admin-users/api/admin-users-api';
import { searchAuditLog } from '../api/audit-log-api';
import type { AuditLogEntry } from '@forge/api-contract';

const columns: DataTableColumn<AuditLogEntry>[] = [
  {
    key: 'occurredAt',
    header: 'When',
    render: (row) => new Date(row.occurredAt).toLocaleString(),
  },
  { key: 'action', header: 'Action', render: (row) => row.action },
  { key: 'entityType', header: 'Resource', render: (row) => row.entityType },
  { key: 'actorUserId', header: 'Actor', render: (row) => row.actorDisplayName ?? 'system' },
  { key: 'outcome', header: 'Outcome', render: (row) => row.outcome },
];

export function AuditCenterPage() {
  const { activeOrganizationId } = useActiveOrganization();
  const [actor, setActor] = useState<AdminUser | null>(null);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-log', activeOrganizationId, actor?.id, action, entityType],
    queryFn: () =>
      searchAuditLog(
        {
          actorUserId: actor?.id,
          action: action || undefined,
          entityType: entityType || undefined,
          limit: 50,
        },
        activeOrganizationId,
      ),
    enabled: Boolean(activeOrganizationId),
  });

  return (
    <div>
      <AdminPageHeader
        title="Audit Center"
        description="Read-only search across every recorded platform action."
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PersonSearchField
          label="Filter by actor"
          placeholder="Search actor by name or email…"
          selected={actor}
          onSelect={setActor}
          onClear={() => setActor(null)}
        />
        <Input
          placeholder="Filter by action (e.g. cohort.archived)…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
        />
        <Input
          placeholder="Filter by resource type…"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          aria-label="Filter by resource type"
        />
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        emptyTitle="No matching audit entries"
      />
    </div>
  );
}
