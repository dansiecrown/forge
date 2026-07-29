import { useNavigate } from 'react-router-dom';
import type { MentorCohortSummary } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useMyCohorts } from '../hooks/use-mentor-workspace';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  enrolling: 'brand',
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
  archived: 'danger',
};

const columns: DataTableColumn<MentorCohortSummary>[] = [
  {
    key: 'name',
    header: 'Cohort',
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
  { key: 'studentCount', header: 'Students', render: (row) => row.studentCount },
  {
    key: 'atRiskCount',
    header: 'At risk',
    render: (row) =>
      row.atRiskCount > 0 ? (
        <Badge tone="warning">{row.atRiskCount}</Badge>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
];

export function MentorCohortsListPage() {
  const navigate = useNavigate();
  const { data: cohorts, isLoading, error } = useMyCohorts();

  return (
    <div>
      <AdminPageHeader
        title="My Cohorts"
        description="Cohorts you're currently assigned to mentor."
      />
      <DataTable
        columns={columns}
        rows={cohorts ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        emptyTitle="No cohorts assigned yet"
        emptyDescription="Once an admin assigns you as a mentor to a cohort, it will appear here."
        onRowClick={(row) => navigate(`/mentor/cohorts/${row.id}`)}
      />
    </div>
  );
}
