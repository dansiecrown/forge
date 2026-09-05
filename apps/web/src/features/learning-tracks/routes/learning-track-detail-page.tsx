import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Route } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { ActionsMenu } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { buildPublishLifecycleItems } from '@/components/admin/publish-lifecycle-items';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { TextareaField } from '@/components/textarea-field';
import { useCoursesList } from '@/features/courses';
import type { Course } from '@forge/api-contract';
import {
  useLearningTrackLifecycleActions,
  useUpdateLearningTrack,
} from '../hooks/use-learning-track-mutations';
import { useLearningTrack } from '../hooks/use-learning-tracks';
import {
  updateLearningTrackSchema,
  type UpdateLearningTrackFormValues,
} from '../schemas/learning-track-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

const courseColumns: DataTableColumn<Course>[] = [
  {
    key: 'title',
    header: 'Title',
    render: (row) => <span className="font-medium text-foreground">{row.title}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
  { key: 'estimatedHours', header: 'Est. hours', render: (row) => row.estimatedHours ?? '—' },
];

export function LearningTrackDetailPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { data: track, isLoading, error } = useLearningTrack(trackId);
  const updateTrack = useUpdateLearningTrack(trackId ?? '');
  const { publish, archive, restore } = useLearningTrackLifecycleActions(trackId ?? '');
  const courses = useCoursesList(trackId);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const form = useForm<UpdateLearningTrackFormValues>({
    resolver: zodResolver(updateLearningTrackSchema),
  });

  useEffect(() => {
    if (track) {
      form.reset({
        name: track.name,
        description: track.description ?? '',
        difficulty: track.difficulty,
        estimatedWeeks: track.estimatedWeeks ?? '',
        learningOutcomes: track.learningOutcomes.join(', '),
        tags: track.tags.join(', '),
      });
    }
  }, [track, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !track) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Learning track not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateLearningTrackFormValues) {
    if (!track) return;
    try {
      await updateTrack.mutateAsync({
        body: {
          name: values.name,
          description: values.description || undefined,
          difficulty: values.difficulty,
          estimatedWeeks: values.estimatedWeeks ? Number(values.estimatedWeeks) : undefined,
          learningOutcomes: values.learningOutcomes
            ? values.learningOutcomes
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          tags: values.tags
            ? values.tags
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        },
        version: track.version,
      });
    } catch {
      // surfaced below via updateTrack.error
    }
  }

  const updateErrorMessage =
    updateTrack.error instanceof ApiError ? updateTrack.error.message : null;

  async function onConfirmArchive() {
    if (!track) return;
    try {
      await archive.mutateAsync(track.version);
      setConfirmingArchive(false);
    } catch {
      // surfaced below via archive.error
    }
  }

  const lifecycleItems = buildPublishLifecycleItems({
    status: track.status,
    publishing: publish.isPending,
    restoring: restore.isPending,
    onPublish: () => publish.mutate(track.version),
    onArchiveRequest: () => setConfirmingArchive(true),
    onRestore: () => restore.mutate(track.version),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={track.name}
        description={
          <>
            <Link
              to={`/admin/fellowships/${track.fellowshipId}/tracks`}
              className="text-brand hover:underline"
            >
              Learning Tracks
            </Link>{' '}
            / {track.slug}
          </>
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[track.status]}>{track.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Route className="size-5 text-muted-foreground" aria-hidden="true" />
            Track details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {updateErrorMessage ? <Alert variant="danger">{updateErrorMessage}</Alert> : null}
            <FormField
              label="Name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <TextareaField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select id="difficulty" {...form.register('difficulty')}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </Select>
                {form.formState.errors.difficulty ? (
                  <p className="text-sm text-danger" aria-live="polite">
                    {form.formState.errors.difficulty.message}
                  </p>
                ) : null}
              </div>
              <FormField
                label="Estimated weeks"
                type="number"
                error={form.formState.errors.estimatedWeeks?.message}
                {...form.register('estimatedWeeks')}
              />
            </div>
            <FormField
              label="Learning outcomes (comma-separated)"
              error={form.formState.errors.learningOutcomes?.message}
              {...form.register('learningOutcomes')}
            />
            <FormField
              label="Tags (comma-separated)"
              error={form.formState.errors.tags?.message}
              {...form.register('tags')}
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={updateTrack.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle as="h2">Courses</CardTitle>
          <Badge tone="neutral">{courses.rows.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => navigate(`/admin/tracks/${track.id}/courses/new`)}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add course
            </Button>
          </div>
          <DataTable
            columns={courseColumns}
            rows={courses.rows}
            rowKey={(row) => row.id}
            isLoading={courses.isLoading}
            error={courses.error}
            emptyTitle="No courses yet"
            emptyDescription="Add the first course to this learning track."
            onRowClick={(row) => navigate(`/admin/courses/${row.id}`)}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmingArchive}
        onClose={() => setConfirmingArchive(false)}
        onConfirm={onConfirmArchive}
        loading={archive.isPending}
        error={archive.error instanceof ApiError ? archive.error.message : null}
        title="Archive this learning track?"
        description="You can restore it back to draft later if needed."
        confirmLabel="Archive"
      />
    </div>
  );
}
