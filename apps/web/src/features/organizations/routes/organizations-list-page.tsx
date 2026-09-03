import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Organization } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { LoadMore } from '@/components/admin/load-more';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { useOrganizationsList } from '../hooks/use-organizations';

const STATUS_OPTIONS = [
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  provisioning: 'neutral',
  active: 'success',
  suspended: 'warning',
  archived: 'danger',
};

const columns: DataTableColumn<Organization>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  { key: 'slug', header: 'Slug', render: (row) => row.slug },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
  { key: 'country', header: 'Country', render: (row) => row.country ?? '—' },
];

export function OrganizationsListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { rows, isLoading, error, hasMore, loadMore } = useOrganizationsList(q, status);
  const permissions = usePermissions();

  return (
    <div>
      <AdminPageHeader
        title="Organizations"
        description="Platform tenants — provision, suspend, archive and restore."
        action={
          permissions.has('organization.create') ? (
            <Button onClick={() => navigate('/admin/organizations/new')}>
              <Plus className="size-4" aria-hidden="true" />
              New organization
            </Button>
          ) : undefined
        }
      />
      <ListToolbar
        q={q}
        onQChange={setQ}
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        searchPlaceholder="Search organizations…"
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No organizations yet"
        emptyDescription="Provision your first tenant to get started."
        onRowClick={(row) => navigate(`/admin/organizations/${row.id}`)}
      />
      <LoadMore hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />
    </div>
  );
}
