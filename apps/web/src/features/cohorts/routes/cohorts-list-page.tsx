import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Cohort } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { LoadMore } from '@/components/admin/load-more';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useCohortsList } from '../hooks/use-cohorts';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'enrolling', label: 'Enrolling' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  enrolling: 'brand',
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
  archived: 'danger',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const columns: DataTableColumn<Cohort>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  {
    key: 'dates',
    header: 'Dates',
    render: (row) => `${formatDate(row.startsAt)} – ${formatDate(row.endsAt)}`,
  },
  { key: 'capacity', header: 'Capacity', render: (row) => row.capacity },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
];

export function CohortsListPage() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { rows, isLoading, error, hasMore, loadMore } = useCohortsList(q, status);

  if (!activeOrganizationId) {
    return (
      <p className="text-sm text-muted-foreground">Select an organization to view its cohorts.</p>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Cohorts"
        description="Dated, capacity-bound delivery runs of a fellowship."
        action={
          <Button onClick={() => navigate('/admin/cohorts/new')}>
            <Plus className="size-4" aria-hidden="true" />
            New cohort
          </Button>
        }
      />
      <ListToolbar
        q={q}
        onQChange={setQ}
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        searchPlaceholder="Search cohorts…"
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No cohorts yet"
        emptyDescription="Schedule a cohort to start enrolling learners into a fellowship."
        onRowClick={(row) => navigate(`/admin/cohorts/${row.id}`)}
      />
      <LoadMore hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />
    </div>
  );
}
