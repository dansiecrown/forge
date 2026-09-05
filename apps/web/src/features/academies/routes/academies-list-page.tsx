import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Academy } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { LoadMore } from '@/components/admin/load-more';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActiveOrganization } from '@/contexts/organization-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useAcademiesList } from '../hooks/use-academies';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<string, BadgeProps['tone']> = { active: 'success', archived: 'danger' };

const columns: DataTableColumn<Academy>[] = [
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
  {
    key: 'visibility',
    header: 'Visibility',
    render: (row) => (row.isPublic ? 'Public' : 'Private'),
  },
];

export function AcademiesListPage() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { rows, isLoading, error, hasMore, loadMore } = useAcademiesList(q, status);
  const permissions = usePermissions();

  if (!activeOrganizationId) {
    return (
      <p className="text-sm text-muted-foreground">Select an organization to view its academies.</p>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Academies"
        description="Organization-owned learning brands and divisions."
        action={
          permissions.has('academy.create') ? (
            <Button onClick={() => navigate('/admin/academies/new')}>
              <Plus className="size-4" aria-hidden="true" />
              New academy
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
        searchPlaceholder="Search academies…"
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No academies yet"
        emptyDescription="Create an academy to organize fellowships under this organization."
        onRowClick={(row) => navigate(`/admin/academies/${row.id}`)}
      />
      <LoadMore hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />
    </div>
  );
}
