import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { TextareaField } from '@/components/textarea-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useCreateLesson } from '../hooks/use-lesson-mutations';
import { createLessonSchema, type CreateLessonFormValues } from '../schemas/lesson-schemas';

export function LessonCreatePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const createLesson = useCreateLesson(moduleId ?? '');

  const form = useForm<CreateLessonFormValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: { lessonType: 'article', completionRequired: true },
  });

  if (!activeOrganizationId || !moduleId) return null;

  async function onSubmit(values: CreateLessonFormValues) {
    try {
      const created = await createLesson.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        lessonType: values.lessonType,
        estimatedDurationMinutes: values.estimatedDurationMinutes
          ? Number(values.estimatedDurationMinutes)
          : undefined,
        resourceUrl: values.resourceUrl || undefined,
        completionRequired: values.completionRequired,
      });
      navigate(`/admin/lessons/${created.id}`);
    } catch {
      // surfaced below via createLesson.error
    }
  }

  const errorMessage = createLesson.error instanceof ApiError ? createLesson.error.message : null;

  return (
    <div>
      <AdminPageHeader title="New lesson" description="Add a lesson to this weekly module." />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Lesson details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
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
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={createLesson.isPending}>
                Create lesson
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
