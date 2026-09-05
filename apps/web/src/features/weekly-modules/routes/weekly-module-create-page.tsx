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
import { TextareaField } from '@/components/textarea-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useCreateWeeklyModule } from '../hooks/use-weekly-module-mutations';
import {
  createWeeklyModuleSchema,
  type CreateWeeklyModuleFormValues,
} from '../schemas/weekly-module-schemas';

export function WeeklyModuleCreatePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const createModule = useCreateWeeklyModule(courseId ?? '');

  const form = useForm<CreateWeeklyModuleFormValues>({
    resolver: zodResolver(createWeeklyModuleSchema),
  });

  if (!activeOrganizationId || !courseId) return null;

  async function onSubmit(values: CreateWeeklyModuleFormValues) {
    try {
      const created = await createModule.mutateAsync({
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
      });
      navigate(`/admin/modules/${created.id}`);
    } catch {
      // surfaced below via createModule.error
    }
  }

  const errorMessage = createModule.error instanceof ApiError ? createModule.error.message : null;

  return (
    <div>
      <AdminPageHeader title="New weekly module" description="Add a week to this course." />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Week details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
            <div className="grid grid-cols-2 gap-4">
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
            </div>
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
            <TextareaField
              label="Summary"
              error={form.formState.errors.summary?.message}
              {...form.register('summary')}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requiresMentorHuddle"
                className="size-4 rounded border-border"
                {...form.register('requiresMentorHuddle')}
              />
              <Label htmlFor="requiresMentorHuddle">Requires a mentor huddle this week</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requiresPracticalWork"
                className="size-4 rounded border-border"
                {...form.register('requiresPracticalWork')}
              />
              <Label htmlFor="requiresPracticalWork">Requires practical work this week</Label>
            </div>
            <FormField
              label="Huddle meeting link"
              error={form.formState.errors.huddleMeetingLink?.message}
              {...form.register('huddleMeetingLink')}
            />
            <TextareaField
              label="Mentor huddle notes"
              error={form.formState.errors.mentorHuddleNotes?.message}
              {...form.register('mentorHuddleNotes')}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="huddleAttendanceRequired"
                className="size-4 rounded border-border"
                {...form.register('huddleAttendanceRequired')}
              />
              <Label htmlFor="huddleAttendanceRequired">Huddle attendance is required</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={createModule.isPending}>
                Create week
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
