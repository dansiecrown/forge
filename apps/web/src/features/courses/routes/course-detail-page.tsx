import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { TextareaField } from '@/components/textarea-field';
import { useWeeklyModulesList } from '@/features/weekly-modules';
import type { WeeklyModule } from '@forge/api-contract';
import { useCourseLifecycleActions, useUpdateCourse } from '../hooks/use-course-mutations';
import { useCourse } from '../hooks/use-courses';
import { updateCourseSchema, type UpdateCourseFormValues } from '../schemas/course-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

const moduleColumns: DataTableColumn<WeeklyModule>[] = [
  { key: 'weekNumber', header: 'Week', render: (row) => `Week ${row.weekNumber}` },
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
];

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading, error } = useCourse(courseId);
  const updateCourse = useUpdateCourse(courseId ?? '');
  const { publish, archive, restore } = useCourseLifecycleActions(courseId ?? '');
  const modules = useWeeklyModulesList(courseId);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const form = useForm<UpdateCourseFormValues>({ resolver: zodResolver(updateCourseSchema) });

  useEffect(() => {
    if (course) {
      form.reset({
        title: course.title,
        overview: course.overview ?? '',
        objectives: course.objectives.join(', '),
        completionCriteria: course.completionCriteria ?? '',
        estimatedHours: course.estimatedHours ?? '',
      });
    }
  }, [course, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Course not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateCourseFormValues) {
    if (!course) return;
    try {
      await updateCourse.mutateAsync({
        body: {
          title: values.title,
          overview: values.overview || undefined,
          objectives: values.objectives
            ? values.objectives
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          completionCriteria: values.completionCriteria || undefined,
          estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
        },
        version: course.version,
      });
    } catch {
      // surfaced below via updateCourse.error
    }
  }

  const updateErrorMessage =
    updateCourse.error instanceof ApiError ? updateCourse.error.message : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={course.title}
        description={
          <>
            <Link
              to={`/admin/tracks/${course.learningTrackId}`}
              className="text-brand hover:underline"
            >
              Learning Track
            </Link>{' '}
            / {course.slug}
          </>
        }
        action={<Badge tone={STATUS_TONE[course.status]}>{course.status}</Badge>}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Course details</CardTitle>
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
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={updateCourse.isPending}>
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
                  await archive.mutateAsync(course.version);
                  setConfirmingArchive(false);
                }}
              >
                Confirm archive
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {course.status === 'draft' ? (
                <Button
                  variant="secondary"
                  loading={publish.isPending}
                  onClick={() => publish.mutate(course.version)}
                >
                  Publish
                </Button>
              ) : null}
              {course.status !== 'archived' ? (
                <Button variant="destructive" onClick={() => setConfirmingArchive(true)}>
                  Archive
                </Button>
              ) : null}
              {course.status === 'archived' ? (
                <Button
                  variant="secondary"
                  loading={restore.isPending}
                  onClick={() => restore.mutate(course.version)}
                >
                  Restore
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Weekly Modules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => navigate(`/admin/courses/${course.id}/modules/new`)}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add week
            </Button>
          </div>
          <DataTable
            columns={moduleColumns}
            rows={modules.rows}
            rowKey={(row) => row.id}
            isLoading={modules.isLoading}
            error={modules.error}
            emptyTitle="No weekly modules yet"
            emptyDescription="Add Week 1 to start structuring this course."
            onRowClick={(row) => navigate(`/admin/modules/${row.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
