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
import { useCreatePracticalTask } from '../hooks/use-practical-task-mutations';
import {
  createPracticalTaskSchema,
  type CreatePracticalTaskFormValues,
} from '../schemas/practical-task-schemas';

export function PracticalTaskCreatePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const createTask = useCreatePracticalTask(moduleId ?? '');

  const form = useForm<CreatePracticalTaskFormValues>({
    resolver: zodResolver(createPracticalTaskSchema),
  });

  if (!activeOrganizationId || !moduleId) return null;

  async function onSubmit(values: CreatePracticalTaskFormValues) {
    try {
      const created = await createTask.mutateAsync({
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
      });
      navigate(`/admin/practical-tasks/${created.id}`);
    } catch {
      // surfaced below via createTask.error
    }
  }

  const errorMessage = createTask.error instanceof ApiError ? createTask.error.message : null;

  return (
    <div>
      <AdminPageHeader
        title="New practical task"
        description="Add hands-on work to this weekly module."
      />
      <Card>
        <CardHeader>
          <CardTitle as="h2">Task details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {errorMessage ? (
              <Alert variant="danger" className="w-full">
                {errorMessage}
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
            <div className="flex w-full justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={createTask.isPending}>
                Create task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
