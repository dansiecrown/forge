import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
        action={<Badge tone={STATUS_TONE[lesson.status]}>{lesson.status}</Badge>}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Lesson details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {updateErrorMessage ? <Alert variant="danger">{updateErrorMessage}</Alert> : null}
            <FormField
              label="Title"
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <TextareaField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lessonType">Lesson type</Label>
                <Select id="lessonType" {...form.register('lessonType')}>
                  <option value="video">Video</option>
                  <option value="article">Article</option>
                  <option value="documentation">Documentation</option>
                  <option value="reading">Reading</option>
                  <option value="external_resource">External resource</option>
                  <option value="live_session_reference">Live session reference</option>
                  <option value="embedded_content">Embedded content</option>
                </Select>
              </div>
              <FormField
                label="Estimated duration (minutes)"
                type="number"
                error={form.formState.errors.estimatedDurationMinutes?.message}
                {...form.register('estimatedDurationMinutes')}
              />
            </div>
            <FormField
              label="Resource URL"
              error={form.formState.errors.resourceUrl?.message}
              {...form.register('resourceUrl')}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="completionRequired"
                className="size-4 rounded border-border"
                {...form.register('completionRequired')}
              />
              <Label htmlFor="completionRequired">Required for progression</Label>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={updateLesson.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          {confirmingArchive ? (
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirmingArchive(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={archive.isPending}
                onClick={async () => {
                  await archive.mutateAsync(lesson.version);
                  setConfirmingArchive(false);
                }}
              >
                Confirm archive
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {lesson.status === 'draft' ? (
                <Button
                  variant="secondary"
                  loading={publish.isPending}
                  onClick={() => publish.mutate(lesson.version)}
                >
                  Publish
                </Button>
              ) : null}
              {lesson.status !== 'archived' ? (
                <Button variant="destructive" onClick={() => setConfirmingArchive(true)}>
                  Archive
                </Button>
              ) : null}
              {lesson.status === 'archived' ? (
                <Button
                  variant="secondary"
                  loading={restore.isPending}
                  onClick={() => restore.mutate(lesson.version)}
                >
                  Restore
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
