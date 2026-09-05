import { useNavigate } from 'react-router-dom';
import type { MentorReviewQueueItem } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { useReviewQueue } from '@/features/mentor-workspace/hooks/use-mentor-workspace';

const columns: DataTableColumn<MentorReviewQueueItem>[] = [
  {
    key: 'student',
    header: 'Student',
    render: (row) => <span className="font-medium text-foreground">{row.studentDisplayName}</span>,
  },
  { key: 'task', header: 'Task', render: (row) => row.taskTitle },
  { key: 'cohort', header: 'Cohort', render: (row) => row.cohortName },
  {
    key: 'submittedAt',
    header: 'Submitted',
    render: (row) => (row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'),
  },
  {
    key: 'resubmission',
    header: '',
    render: (row) => (row.isResubmission ? <Badge tone="brand">Resubmission</Badge> : null),
  },
];

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const { data: queue, isLoading, error } = useReviewQueue();

  return (
    <div>
      <AdminPageHeader
        title="Review Queue"
        description="Submitted practical tasks awaiting your review, across every cohort you mentor."
      />
      <DataTable
        columns={columns}
        rows={queue ?? []}
        rowKey={(row) => row.submissionId}
        isLoading={isLoading}
        error={error as Error | null}
        emptyTitle="Nothing pending review"
        emptyDescription="You're all caught up — no submissions are waiting on you right now."
        onRowClick={(row) => navigate(`/mentor/submissions/${row.submissionId}`)}
      />
    </div>
  );
}
