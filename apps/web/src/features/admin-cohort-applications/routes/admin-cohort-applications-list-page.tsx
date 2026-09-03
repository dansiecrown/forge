import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CohortApplication } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { LoadMore } from '@/components/admin/load-more';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { useCohortApplicationsList } from '../hooks/use-admin-cohort-applications';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  pending: 'brand',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

const columns: DataTableColumn<CohortApplication>[] = [
  {
    key: 'applicant',
    header: 'Applicant',
    render: (row) => (
      <span className="font-medium text-foreground">
        {row.prospectDisplayName ?? row.applicantUserId}
      </span>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    render: (row) => row.prospectEmail ?? '—',
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
  {
    key: 'createdAt',
    header: 'Submitted',
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
];

export function AdminCohortApplicationsListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('pending');
  const { rows, isLoading, error, hasMore, loadMore } = useCohortApplicationsList(status);

  return (
    <div>
      <AdminPageHeader
        title="Cohort Applications"
        description="Review and approve or reject requests to join a public cohort."
      />
      <div className="mb-4 flex items-center gap-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="w-auto min-w-[160px]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No applications found"
        onRowClick={(row) => navigate(`/admin/applications/${row.id}`)}
      />
      <LoadMore hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />
    </div>
  );
}
