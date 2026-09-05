import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { TextareaField } from '@/components/textarea-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useCreateCourse } from '../hooks/use-course-mutations';
import { createCourseSchema, type CreateCourseFormValues } from '../schemas/course-schemas';

export function CourseCreatePage() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const createCourse = useCreateCourse(trackId ?? '');

  const form = useForm<CreateCourseFormValues>({ resolver: zodResolver(createCourseSchema) });

  if (!activeOrganizationId || !trackId) return null;

  async function onSubmit(values: CreateCourseFormValues) {
    try {
      const created = await createCourse.mutateAsync({
        title: values.title,
        slug: values.slug,
        overview: values.overview || undefined,
        objectives: values.objectives
          ? values.objectives
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        completionCriteria: values.completionCriteria || undefined,
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
      });
      navigate(`/admin/courses/${created.id}`);
    } catch {
      // surfaced below via createCourse.error
    }
  }

  const errorMessage = createCourse.error instanceof ApiError ? createCourse.error.message : null;

  return (
    <div>
      <AdminPageHeader title="New course" description="Add a course to this learning track." />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Course details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
            <FormField
              label="Title"
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <FormField
              label="URL slug"
              error={form.formState.errors.slug?.message}
              {...form.register('slug')}
            />
            <TextareaField
              label="Overview"
              error={form.formState.errors.overview?.message}
              {...form.register('overview')}
            />
            <FormField
              label="Objectives (comma-separated)"
              error={form.formState.errors.objectives?.message}
              {...form.register('objectives')}
            />
            <TextareaField
              label="Completion criteria"
              error={form.formState.errors.completionCriteria?.message}
              {...form.register('completionCriteria')}
            />
            <FormField
              label="Estimated hours"
              type="number"
              error={form.formState.errors.estimatedHours?.message}
              {...form.register('estimatedHours')}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={createCourse.isPending}>
                Create course
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
