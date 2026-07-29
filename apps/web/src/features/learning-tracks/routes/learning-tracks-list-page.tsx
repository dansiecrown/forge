import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LearningTrack } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { LoadMore } from '@/components/admin/load-more';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLearningTracksList } from '../hooks/use-learning-tracks';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

const columns: DataTableColumn<LearningTrack>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  { key: 'difficulty', header: 'Difficulty', render: (row) => row.difficulty },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
  {
    key: 'estimatedWeeks',
    header: 'Estimated weeks',
    render: (row) => row.estimatedWeeks ?? '—',
  },
];

export function LearningTracksListPage() {
  const { fellowshipId } = useParams<{ fellowshipId: string }>();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { rows, isLoading, error, hasMore, loadMore } = useLearningTracksList(
    fellowshipId,
    q,
    status,
  );

  return (
    <div>
      <AdminPageHeader
        title="Learning Tracks"
        description="Structured learning paths within this fellowship programme."
        action={
          <Button onClick={() => navigate(`/admin/fellowships/${fellowshipId}/tracks/new`)}>
            <Plus className="size-4" aria-hidden="true" />
            New track
          </Button>
        }
      />
      <ListToolbar
        q={q}
        onQChange={setQ}
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        searchPlaceholder="Search learning tracks…"
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No learning tracks yet"
        emptyDescription="Add your first track to structure this fellowship's curriculum."
        onRowClick={(row) => navigate(`/admin/tracks/${row.id}`)}
      />
      <LoadMore hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />
    </div>
  );
}
