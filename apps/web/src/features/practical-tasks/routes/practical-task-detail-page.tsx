import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { ActionsMenu } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { buildPublishLifecycleItems } from '@/components/admin/publish-lifecycle-items';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { TextareaField } from '@/components/textarea-field';
import {
  usePracticalTaskLifecycleActions,
  useUpdatePracticalTask,
} from '../hooks/use-practical-task-mutations';
import { usePracticalTask } from '../hooks/use-practical-tasks';
import {
  updatePracticalTaskSchema,
  type UpdatePracticalTaskFormValues,
} from '../schemas/practical-task-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

export function PracticalTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, isLoading, error } = usePracticalTask(taskId);
  const updateTask = useUpdatePracticalTask(taskId ?? '');
  const { publish, archive, restore } = usePracticalTaskLifecycleActions(taskId ?? '');
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const form = useForm<UpdatePracticalTaskFormValues>({
    resolver: zodResolver(updatePracticalTaskSchema),
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        instructions: task.instructions ?? '',
        deliverables: task.deliverables.join(', '),
        dueOffsetDays: task.dueOffsetDays ?? '',
        maxScore: task.maxScore ?? '',
      });
    }
  }, [task, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Practical task not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdatePracticalTaskFormValues) {
    if (!task) return;
    try {
      await updateTask.mutateAsync({
        body: {
          title: values.title,
          description: values.description || undefined,
          instructions: values.instructions || undefined,
          deliverables: values.deliverables
            ? values.deliverables
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          dueOffsetDays: values.dueOffsetDays ? Number(values.dueOffsetDays) : undefined,
          maxScore: values.maxScore ? Number(values.maxScore) : undefined,
        },
        version: task.version,
      });
    } catch {
      // surfaced below via updateTask.error
    }
  }

  const updateErrorMessage = updateTask.error instanceof ApiError ? updateTask.error.message : null;

  async function onConfirmArchive() {
    if (!task) return;
    try {
      await archive.mutateAsync(task.version);
      setConfirmingArchive(false);
    } catch {
      // surfaced below via archive.error
    }
  }

  const lifecycleItems = buildPublishLifecycleItems({
    status: task.status,
    publishing: publish.isPending,
    restoring: restore.isPending,
    onPublish: () => publish.mutate(task.version),
    onArchiveRequest: () => setConfirmingArchive(true),
    onRestore: () => restore.mutate(task.version),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={task.title}
        description={
          <Link to={`/admin/modules/${task.weeklyModuleId}`} className="text-brand hover:underline">
            Back to weekly module
          </Link>
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[task.status]}>{task.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-muted-foreground" aria-hidden="true" />
            Task details
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
              label="Title"
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <FormField
              label="Deliverables (comma-separated)"
              error={form.formState.errors.deliverables?.message}
              {...form.register('deliverables')}
            />
            <FormField
              label="Due offset (days after week unlocks)"
              type="number"
              error={form.formState.errors.dueOffsetDays?.message}
              {...form.register('dueOffsetDays')}
            />
            <FormField
              label="Maximum score"
              type="number"
              error={form.formState.errors.maxScore?.message}
              {...form.register('maxScore')}
            />
            <TextareaField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <TextareaField
              label="Instructions"
              error={form.formState.errors.instructions?.message}
              {...form.register('instructions')}
            />
            <div className="flex w-full justify-end pt-2">
              <Button type="submit" loading={updateTask.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmingArchive}
        onClose={() => setConfirmingArchive(false)}
        onConfirm={onConfirmArchive}
        loading={archive.isPending}
        error={archive.error instanceof ApiError ? archive.error.message : null}
        title="Archive this practical task?"
        description="You can restore it back to draft later if needed."
        confirmLabel="Archive"
      />
    </div>
  );
}
