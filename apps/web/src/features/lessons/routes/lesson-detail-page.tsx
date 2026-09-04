import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlayCircle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/select-field';
import { TextareaField } from '@/components/textarea-field';
import { useLessonLifecycleActions, useUpdateLesson } from '../hooks/use-lesson-mutations';
import { useLesson } from '../hooks/use-lessons';
import { updateLessonSchema, type UpdateLessonFormValues } from '../schemas/lesson-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { data: lesson, isLoading, error } = useLesson(lessonId);
  const updateLesson = useUpdateLesson(lessonId ?? '');
  const { publish, archive, restore } = useLessonLifecycleActions(lessonId ?? '');
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const form = useForm<UpdateLessonFormValues>({ resolver: zodResolver(updateLessonSchema) });

  useEffect(() => {
    if (lesson) {
      form.reset({
        title: lesson.title,
        description: lesson.description ?? '',
        lessonType: lesson.lessonType,
        estimatedDurationMinutes: lesson.estimatedDurationMinutes ?? '',
        resourceUrl: lesson.resourceUrl ?? '',
        completionRequired: lesson.completionRequired,
      });
    }
  }, [lesson, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Lesson not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateLessonFormValues) {
    if (!lesson) return;
    try {
      await updateLesson.mutateAsync({
        body: {
          title: values.title,
          description: values.description || undefined,
          lessonType: values.lessonType,
          estimatedDurationMinutes: values.estimatedDurationMinutes
            ? Number(values.estimatedDurationMinutes)
            : undefined,
          resourceUrl: values.resourceUrl || undefined,
          completionRequired: values.completionRequired,
        },
        version: lesson.version,
      });
    } catch {
      // surfaced below via updateLesson.error
    }
  }

  const updateErrorMessage =
    updateLesson.error instanceof ApiError ? updateLesson.error.message : null;

  async function onConfirmArchive() {
    if (!lesson) return;
    try {
      await archive.mutateAsync(lesson.version);
      setConfirmingArchive(false);
    } catch {
      // surfaced below via archive.error
    }
  }

  const lifecycleItems = buildPublishLifecycleItems({
    status: lesson.status,
    publishing: publish.isPending,
    restoring: restore.isPending,
    onPublish: () => publish.mutate(lesson.version),
    onArchiveRequest: () => setConfirmingArchive(true),
    onRestore: () => restore.mutate(lesson.version),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lesson.title}
        description={
          <Link
            to={`/admin/modules/${lesson.weeklyModuleId}`}
            className="text-brand hover:underline"
          >
            Back to weekly module
          </Link>
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[lesson.status]}>{lesson.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <PlayCircle className="size-5 text-muted-foreground" aria-hidden="true" />
            Lesson details
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
            <SelectField label="Lesson type" {...form.register('lessonType')}>
              <option value="video">Video</option>
              <option value="article">Article</option>
              <option value="documentation">Documentation</option>
              <option value="reading">Reading</option>
              <option value="external_resource">External resource</option>
              <option value="live_session_reference">Live session reference</option>
              <option value="embedded_content">Embedded content</option>
            </SelectField>
            <FormField
              label="Estimated duration (minutes)"
              type="number"
              error={form.formState.errors.estimatedDurationMinutes?.message}
              {...form.register('estimatedDurationMinutes')}
            />
            <FormField
              label="Resource URL"
              error={form.formState.errors.resourceUrl?.message}
              {...form.register('resourceUrl')}
            />
            <TextareaField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="flex w-full items-center gap-2">
              <input
                type="checkbox"
                id="completionRequired"
                className="size-4 rounded border-border"
                {...form.register('completionRequired')}
              />
              <Label htmlFor="completionRequired">Required for progression</Label>
            </div>
            <div className="flex w-full justify-end pt-2">
              <Button type="submit" loading={updateLesson.isPending}>
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
        title="Archive this lesson?"
        description="You can restore it back to draft later if needed."
        confirmLabel="Archive"
      />
    </div>
  );
}
