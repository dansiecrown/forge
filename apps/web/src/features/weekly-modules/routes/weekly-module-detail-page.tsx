import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Loader2, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { ActionsMenu } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { buildPublishLifecycleItems } from '@/components/admin/publish-lifecycle-items';
import { SortableList } from '@/components/admin/sortable-list';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { TextareaField } from '@/components/textarea-field';
import { useLessonsList, useReorderLessons } from '@/features/lessons';
import {
  useLearningResourcesList,
  useReorderLearningResources,
} from '@/features/learning-resources';
import { usePracticalTasksList, useReorderPracticalTasks } from '@/features/practical-tasks';
import {
  useUpdateWeeklyModule,
  useWeeklyModuleLifecycleActions,
} from '../hooks/use-weekly-module-mutations';
import { useWeeklyModule } from '../hooks/use-weekly-modules';
import {
  updateWeeklyModuleSchema,
  type UpdateWeeklyModuleFormValues,
} from '../schemas/weekly-module-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

export function WeeklyModuleDetailPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { data: module_, isLoading, error } = useWeeklyModule(moduleId);
  const updateModule = useUpdateWeeklyModule(moduleId ?? '');
  const { publish, archive, restore } = useWeeklyModuleLifecycleActions(moduleId ?? '');
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const lessons = useLessonsList(moduleId);
  const reorderLessons = useReorderLessons(moduleId ?? '');
  const resources = useLearningResourcesList(moduleId);
  const reorderResources = useReorderLearningResources(moduleId ?? '');
  const tasks = usePracticalTasksList(moduleId);
  const reorderTasks = useReorderPracticalTasks(moduleId ?? '');

  const form = useForm<UpdateWeeklyModuleFormValues>({
    resolver: zodResolver(updateWeeklyModuleSchema),
  });

  useEffect(() => {
    if (module_) {
      form.reset({
        weekNumber: module_.weekNumber,
        title: module_.title,
        objectives: module_.objectives.join(', '),
        summary: module_.summary ?? '',
        estimatedStudyHours: module_.estimatedStudyHours ?? '',
        requiresMentorHuddle: module_.requiresMentorHuddle,
        requiresPracticalWork: module_.requiresPracticalWork,
        huddleMeetingLink: module_.huddleMeetingLink ?? '',
        mentorHuddleNotes: module_.mentorHuddleNotes ?? '',
        huddleAttendanceRequired: module_.huddleAttendanceRequired,
      });
    }
  }, [module_, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !module_) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Weekly module not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateWeeklyModuleFormValues) {
    if (!module_) return;
    try {
      await updateModule.mutateAsync({
        body: {
          weekNumber: Number(values.weekNumber),
          title: values.title,
          objectives: values.objectives
            ? values.objectives
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          summary: values.summary || undefined,
          estimatedStudyHours: values.estimatedStudyHours
            ? Number(values.estimatedStudyHours)
            : undefined,
          requiresMentorHuddle: values.requiresMentorHuddle,
          requiresPracticalWork: values.requiresPracticalWork,
          huddleMeetingLink: values.huddleMeetingLink || undefined,
          mentorHuddleNotes: values.mentorHuddleNotes || undefined,
          huddleAttendanceRequired: values.huddleAttendanceRequired,
        },
        version: module_.version,
      });
    } catch {
      // surfaced below via updateModule.error
    }
  }

  const updateErrorMessage =
    updateModule.error instanceof ApiError ? updateModule.error.message : null;

  async function onConfirmArchive() {
    if (!module_) return;
    try {
      await archive.mutateAsync(module_.version);
      setConfirmingArchive(false);
    } catch {
      // surfaced below via archive.error
    }
  }

  const lifecycleItems = buildPublishLifecycleItems({
    status: module_.status,
    publishing: publish.isPending,
    restoring: restore.isPending,
    onPublish: () => publish.mutate(module_.version),
    onArchiveRequest: () => setConfirmingArchive(true),
    onRestore: () => restore.mutate(module_.version),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Week ${module_.weekNumber}: ${module_.title}`}
        description={
          <Link to={`/admin/courses/${module_.courseId}`} className="text-brand hover:underline">
            Back to course
          </Link>
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[module_.status]}>{module_.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
            Week details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {updateErrorMessage ? (
              <Alert variant="danger" className="w-full">
                {updateErrorMessage}
              </Alert>
            ) : null}
            <FormField
              label="Week number"
              type="number"
              error={form.formState.errors.weekNumber?.message}
              {...form.register('weekNumber')}
            />
            <FormField
              label="Estimated study hours"
              type="number"
              error={form.formState.errors.estimatedStudyHours?.message}
              {...form.register('estimatedStudyHours')}
            />
            <FormField
              label="Title"
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <FormField
              label="Objectives (comma-separated)"
              error={form.formState.errors.objectives?.message}
              {...form.register('objectives')}
            />
            <FormField
              label="Huddle meeting link"
              error={form.formState.errors.huddleMeetingLink?.message}
              {...form.register('huddleMeetingLink')}
            />
            <TextareaField
              label="Summary"
              error={form.formState.errors.summary?.message}
              {...form.register('summary')}
            />
            <TextareaField
              label="Mentor huddle notes"
              error={form.formState.errors.mentorHuddleNotes?.message}
              {...form.register('mentorHuddleNotes')}
            />
            <div className="flex w-full items-center gap-2">
              <input
                type="checkbox"
                id="requiresMentorHuddle"
                className="size-4 rounded border-border"
                {...form.register('requiresMentorHuddle')}
              />
              <Label htmlFor="requiresMentorHuddle">Requires a mentor huddle this week</Label>
            </div>
            <div className="flex w-full items-center gap-2">
              <input
                type="checkbox"
                id="requiresPracticalWork"
                className="size-4 rounded border-border"
                {...form.register('requiresPracticalWork')}
              />
              <Label htmlFor="requiresPracticalWork">Requires practical work this week</Label>
            </div>
            <div className="flex w-full items-center gap-2">
              <input
                type="checkbox"
                id="huddleAttendanceRequired"
                className="size-4 rounded border-border"
                {...form.register('huddleAttendanceRequired')}
              />
              <Label htmlFor="huddleAttendanceRequired">Huddle attendance is required</Label>
            </div>
            <div className="flex w-full justify-end pt-2">
              <Button type="submit" loading={updateModule.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle as="h2">Lessons</CardTitle>
            <Badge tone="neutral">{lessons.rows.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => navigate(`/admin/modules/${module_.id}/lessons/new`)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add lesson
              </Button>
            </div>
            {lessons.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lessons yet.</p>
            ) : (
              <SortableList
                items={lessons.rows}
                getId={(row) => row.id}
                onReorder={(items) => reorderLessons.mutate(items)}
                renderItem={(row) => (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/lessons/${row.id}`)}
                    className="flex flex-1 items-center gap-2 text-left text-sm text-foreground hover:underline"
                  >
                    {row.title}
                    <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                    {row.completionRequired ? (
                      <span className="text-xs text-muted-foreground">Required</span>
                    ) : null}
                  </button>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle as="h2">Learning Resources</CardTitle>
            <Badge tone="neutral">{resources.rows.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => navigate(`/admin/modules/${module_.id}/resources/new`)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add resource
              </Button>
            </div>
            {resources.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resources yet.</p>
            ) : (
              <SortableList
                items={resources.rows}
                getId={(row) => row.id}
                onReorder={(items) => reorderResources.mutate(items)}
                renderItem={(row) => (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/learning-resources/${row.id}`)}
                    className="flex flex-1 items-center gap-2 text-left text-sm text-foreground hover:underline"
                  >
                    {row.title}
                    <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                    {row.isRequired ? (
                      <span className="text-xs text-muted-foreground">Required</span>
                    ) : null}
                  </button>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle as="h2">Practical Tasks</CardTitle>
            <Badge tone="neutral">{tasks.rows.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => navigate(`/admin/modules/${module_.id}/tasks/new`)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add task
              </Button>
            </div>
            {tasks.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No practical tasks yet.</p>
            ) : (
              <SortableList
                items={tasks.rows}
                getId={(row) => row.id}
                onReorder={(items) => reorderTasks.mutate(items)}
                renderItem={(row) => (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/practical-tasks/${row.id}`)}
                    className="flex flex-1 items-center gap-2 text-left text-sm text-foreground hover:underline"
                  >
                    {row.title}
                    <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                  </button>
                )}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmingArchive}
        onClose={() => setConfirmingArchive(false)}
        onConfirm={onConfirmArchive}
        loading={archive.isPending}
        error={archive.error instanceof ApiError ? archive.error.message : null}
        title="Archive this weekly module?"
        description="You can restore it back to draft later if needed."
        confirmLabel="Archive"
      />
    </div>
  );
}
