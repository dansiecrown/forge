import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CohortApplication } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { LoadMore } from '@/components/admin/load-more';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { useFellowshipOptions } from '@/features/fellowships';
import {
  useBulkCohortApplicationActions,
  useCohortApplicationsList,
} from '../hooks/use-admin-cohort-applications';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  pending: 'brand',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

export function AdminCohortApplicationsListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('pending');
  const [fellowshipId, setFellowshipId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);

  const fellowships = useFellowshipOptions();
  const { rows, isLoading, error, hasMore, loadMore } = useCohortApplicationsList({
    status,
    fellowshipId,
    q,
  });
  const { bulkApprove, bulkReject } = useBulkCohortApplicationActions();

  const selectedRows = rows.filter((row) => selected.has(row.id));
  const bulkMutation = bulkAction === 'approve' ? bulkApprove : bulkReject;
  const bulkResults = bulkMutation.data;
  const failedCount = bulkResults?.filter((result) => !result.success).length ?? 0;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllLoaded() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function onConfirmBulkAction(reason?: string) {
    const items = selectedRows.map((row) => ({ id: row.id, version: row.version }));
    try {
      if (bulkAction === 'approve') {
        await bulkApprove.mutateAsync(items);
      } else if (bulkAction === 'reject') {
        await bulkReject.mutateAsync({ items, reason });
      }
      setSelected(new Set());
      setBulkAction(null);
    } catch {
      // surfaced below via bulkMutation.error — dialog stays open to retry
    }
  }

  const columns: DataTableColumn<CohortApplication>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-10',
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Select application from ${row.prospectDisplayName ?? row.applicantDisplayName ?? 'this applicant'}`}
          className="size-4 rounded border-border"
          checked={selected.has(row.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={() => toggleRow(row.id)}
        />
      ),
    },
    {
      key: 'applicant',
      header: 'Applicant',
      render: (row) => (
        <span className="font-medium text-foreground">
          {row.prospectDisplayName ?? row.applicantDisplayName ?? 'Unknown applicant'}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.prospectEmail ?? row.applicantEmail ?? '—',
    },
    {
      key: 'fellowship',
      header: 'Fellowship',
      render: (row) => row.fellowshipTitle ?? '—',
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

  return (
    <div>
      <AdminPageHeader
        title="Cohort Applications"
        description="Review and approve or reject requests to join a public cohort."
      />
      <ListToolbar
        q={q}
        onQChange={setQ}
        status={status}
        onStatusChange={setStatus}
        statusOptions={[
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'withdrawn', label: 'Withdrawn' },
        ]}
        searchPlaceholder="Search by name or email…"
      />
      <div className="-mt-2 mb-4 flex items-center gap-3">
        <Select
          value={fellowshipId}
          onChange={(event) => setFellowshipId(event.target.value)}
          aria-label="Filter by fellowship"
          className="w-auto min-w-[200px]"
        >
          <option value="">All fellowships</option>
          {(fellowships.data?.items ?? []).map((fellowship) => (
            <option key={fellowship.id} value={fellowship.id}>
              {fellowship.title}
            </option>
          ))}
        </Select>
      </div>

      {selected.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-control border border-border bg-surface-2 px-4 py-3">
          <span className="text-sm text-foreground">{selected.size} selected</span>
          <Button variant="tertiary" onClick={toggleAllLoaded}>
            {selected.size === rows.length
              ? 'Clear selection'
              : `Select all loaded (${rows.length})`}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => setBulkAction('approve')}>
              Approve selected
            </Button>
            <Button variant="destructive" onClick={() => setBulkAction('reject')}>
              Reject selected
            </Button>
          </div>
        </div>
      ) : null}

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

      <ConfirmDialog
        open={bulkAction !== null}
        onClose={() => setBulkAction(null)}
        onConfirm={onConfirmBulkAction}
        loading={bulkMutation.isPending}
        error={bulkMutation.error instanceof ApiError ? bulkMutation.error.message : null}
        title={
          bulkAction === 'approve'
            ? `Approve ${selectedRows.length} application${selectedRows.length === 1 ? '' : 's'}?`
            : `Reject ${selectedRows.length} application${selectedRows.length === 1 ? '' : 's'}?`
        }
        description={
          bulkAction === 'approve'
            ? 'Each approval creates an account (if needed) and enrolls the applicant. Any that fail — a stale version, a cohort at capacity — are reported individually; the rest still go through.'
            : 'Each rejection is recorded individually; any that fail are reported without affecting the rest.'
        }
        reasonLabel={bulkAction === 'reject' ? 'Reason (optional, applied to all)' : undefined}
        reasonRequired={false}
        confirmLabel={bulkAction === 'approve' ? 'Approve all' : 'Reject all'}
        confirmVariant={bulkAction === 'approve' ? 'primary' : 'destructive'}
      />

      {bulkResults ? (
        <Alert variant={failedCount > 0 ? 'danger' : 'success'} className="mt-4">
          {failedCount === 0
            ? `${bulkResults.length} application${bulkResults.length === 1 ? '' : 's'} updated successfully.`
            : `${bulkResults.length - failedCount} succeeded, ${failedCount} failed: ${bulkResults
                .filter((result) => !result.success)
                .map((result) => result.message)
                .join('; ')}`}
        </Alert>
      ) : null}
    </div>
  );
}
