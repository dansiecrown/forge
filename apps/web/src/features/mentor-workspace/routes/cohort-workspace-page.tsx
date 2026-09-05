import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { MentorStudentSummary } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { AtRiskBadge } from '@/components/mentor/at-risk-badge';
import { MentorProgressCell } from '@/components/mentor/mentor-progress-cell';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { useCohortStudents, useMyCohorts } from '../hooks/use-mentor-workspace';

const STATUS_OPTIONS = [
  { value: 'invited', label: 'Invited' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  invited: 'neutral',
  active: 'success',
  paused: 'warning',
  completed: 'brand',
  withdrawn: 'danger',
};

const columns: DataTableColumn<MentorStudentSummary>[] = [
  {
    key: 'displayName',
    header: 'Student',
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.displayName}</p>
        <p className="text-xs text-muted-foreground">{row.email}</p>
      </div>
    ),
  },
  {
    key: 'progress',
    header: 'Progress',
    render: (row) => <MentorProgressCell percent={row.progressPercent} />,
  },
  {
    key: 'currentWeek',
    header: 'Current week',
    render: (row) => row.currentWeekNumber ?? '—',
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
  {
    key: 'atRisk',
    header: 'At risk',
    render: (row) => <AtRiskBadge atRisk={row.atRisk} reason={row.atRiskReason} />,
  },
];

export function CohortWorkspacePage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const navigate = useNavigate();
  const { data: cohorts } = useMyCohorts();
  const cohort = cohorts?.find((c) => c.id === cohortId);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'name' | 'progress' | 'status'>('name');

  const {
    data: students,
    isLoading,
    error,
  } = useCohortStudents(cohortId, {
    q: q || undefined,
    status: status || undefined,
    sort,
  });

  return (
    <div>
      <AdminPageHeader
        title={cohort?.name ?? 'Cohort roster'}
        description="Search, filter and sort the students in this cohort."
      />
      <ListToolbar
        q={q}
        onQChange={setQ}
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        searchPlaceholder="Search students…"
      />
      <div className="-mt-2 mb-4 flex justify-end">
        <Select
          value={sort}
          onChange={(event) => setSort(event.target.value as 'name' | 'progress' | 'status')}
          aria-label="Sort by"
          className="w-auto min-w-[160px]"
        >
          <option value="name">Sort: Name</option>
          <option value="progress">Sort: Progress</option>
          <option value="status">Sort: Status</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={students ?? []}
        rowKey={(row) => row.enrollmentId}
        isLoading={isLoading}
        error={error as Error | null}
        emptyTitle="No students found"
        emptyDescription="No students match your search or filters."
        onRowClick={(row) => navigate(`/mentor/students/${row.enrollmentId}`)}
      />
    </div>
  );
}
