import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { SubmissionReviewHistory } from '@/components/mentor/submission-review-history';
import {
  usePracticalTask,
  useSaveTaskDraft,
  useSubmitTask,
} from '@/features/student-curriculum/hooks/use-student-curriculum';
import {
  taskSubmissionSchema,
  type TaskSubmissionFormValues,
} from '../schemas/practical-task-submission-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  submitted: 'success',
  under_review: 'brand',
  revision_requested: 'warning',
  completed: 'success',
};

export function PracticalTaskPortalDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, isLoading, error } = usePracticalTask(taskId);
  const saveDraft = useSaveTaskDraft(taskId ?? '');
  const submitTask = useSubmitTask(taskId ?? '');

  const form = useForm<TaskSubmissionFormValues>({
    resolver: zodResolver(taskSubmissionSchema),
    defaultValues: { repositoryUrl: '', liveDemoUrl: '' },
  });

  useEffect(() => {
    if (task?.submission) {
      form.reset({
        repositoryUrl: task.submission.repositoryUrl ?? '',
        liveDemoUrl: task.submission.liveDemoUrl ?? '',
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

  const submissionStatus = task.submission?.status ?? 'draft';
  const isSubmitted = submissionStatus !== 'draft';
  const isPastDue = Boolean(task.dueDate) && new Date(task.dueDate as string) < new Date();
  const editingLocked = isSubmitted && isPastDue;

  async function onSaveDraft(values: TaskSubmissionFormValues) {
    await saveDraft.mutateAsync({
      repositoryUrl: values.repositoryUrl || undefined,
      liveDemoUrl: values.liveDemoUrl || undefined,
    });
  }

  const errorMessage =
    saveDraft.error instanceof ApiError
      ? saveDraft.error.message
      : submitTask.error instanceof ApiError
        ? submitTask.error.message
        : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={task.title}
        description={
          <Link
            to={`/portal/weekly-learning/${task.moduleId}`}
            className="text-brand hover:underline"
          >
            Week {task.weekNumber}: {task.moduleTitle}
          </Link>
        }
        action={<Badge tone={STATUS_TONE[submissionStatus]}>{submissionStatus}</Badge>}
      />

      {task.description ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Your submission</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <Alert variant="danger" className="mb-4">
              {errorMessage}
            </Alert>
          ) : null}

          {isSubmitted ? (
            <Alert variant="success" className="mb-4">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Submitted
              {task.submission?.submittedAt
                ? ` on ${new Date(task.submission.submittedAt).toLocaleDateString()}`
                : ''}
              . Editing will move it back to draft — you'll need to submit again.
            </Alert>
          ) : null}

          {editingLocked ? (
            <Alert variant="danger" className="mb-4">
              The submission window has closed. You can no longer edit this task.
            </Alert>
          ) : null}

          <form
            className="flex flex-wrap gap-4"
            onSubmit={form.handleSubmit(onSaveDraft)}
            noValidate
          >
            <FormField
              label="GitHub repository URL"
              type="url"
              disabled={editingLocked}
              error={form.formState.errors.repositoryUrl?.message}
              {...form.register('repositoryUrl')}
            />
            <FormField
              label="Live demo URL"
              type="url"
              disabled={editingLocked}
              error={form.formState.errors.liveDemoUrl?.message}
              {...form.register('liveDemoUrl')}
            />
            <div className="flex w-full flex-wrap justify-end gap-3 pt-2">
              <Button
                type="submit"
                variant="secondary"
                loading={saveDraft.isPending}
                disabled={editingLocked}
              >
                Save draft
              </Button>
              <Button
                type="button"
                loading={submitTask.isPending}
                disabled={
                  editingLocked || (!form.watch('repositoryUrl') && !form.watch('liveDemoUrl'))
                }
                onClick={form.handleSubmit(async (values) => {
                  await onSaveDraft(values);
                  await submitTask.mutateAsync();
                })}
              >
                Submit
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {task.submission?.id ? <SubmissionReviewHistory submissionId={task.submission.id} /> : null}
    </div>
  );
}
