import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Fellowship } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { LoadMore } from '@/components/admin/load-more';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useFellowshipsList } from '../hooks/use-fellowships';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'retired', label: 'Retired' },
];

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  retired: 'danger',
};

const columns: DataTableColumn<Fellowship>[] = [
  {
    key: 'title',
    header: 'Title',
    render: (row) => <span className="font-medium text-foreground">{row.title}</span>,
  },
  { key: 'slug', header: 'Slug', render: (row) => row.slug },
  { key: 'durationWeeks', header: 'Duration', render: (row) => `${row.durationWeeks} weeks` },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
];

export function FellowshipsListPage() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { rows, isLoading, error, hasMore, loadMore } = useFellowshipsList(q, status);

  if (!activeOrganizationId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select an organization to view its fellowships.
      </p>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Fellowships"
        description="Reusable fellowship programmes, delivered via cohorts."
        action={
          <Button onClick={() => navigate('/admin/fellowships/new')}>
            <Plus className="size-4" aria-hidden="true" />
            New fellowship
          </Button>
        }
      />
      <ListToolbar
        q={q}
        onQChange={setQ}
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        searchPlaceholder="Search fellowships…"
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No fellowships yet"
        emptyDescription="Create a fellowship programme to start scheduling cohorts."
        onRowClick={(row) => navigate(`/admin/fellowships/${row.id}`)}
      />
      <LoadMore hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />
    </div>
  );
}
