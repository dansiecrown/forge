import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { TextareaField } from '@/components/textarea-field';
import { SelectField } from '@/components/select-field';
import { EmptyState } from '@/components/portal/empty-state';
import { usePracticalTasks } from '@/features/student-curriculum/hooks/use-student-curriculum';
import { useCreatePortfolioProject, usePortfolioProjects } from '../hooks/use-portfolio';
import {
  createPortfolioProjectSchema,
  type CreatePortfolioProjectFormValues,
} from '../schemas/portfolio-schemas';

export function PortfolioProjectCreatePage() {
  const navigate = useNavigate();
  const { data: tasks, isLoading: tasksLoading } = usePracticalTasks();
  const { data: existingProjects } = usePortfolioProjects();
  const createProject = useCreatePortfolioProject();

  const featuredSubmissionIds = new Set(
    (existingProjects ?? []).map((p) => p.practicalTaskSubmissionId),
  );
  const eligibleTasks = (tasks ?? []).filter(
    (task) =>
      task.submission &&
      task.submission.status !== 'draft' &&
      !featuredSubmissionIds.has(task.submission.id),
  );

  const form = useForm<CreatePortfolioProjectFormValues>({
    resolver: zodResolver(createPortfolioProjectSchema),
    defaultValues: { completionDate: new Date().toISOString().slice(0, 10) },
  });

  if (tasksLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (eligibleTasks.length === 0) {
    return (
      <div>
        <AdminPageHeader title="New portfolio project" />
        <EmptyState
          title="No submitted tasks available to feature"
          description="Submit a practical task first, then come back here to add it to your portfolio."
        />
      </div>
    );
  }

  async function onSubmit(values: CreatePortfolioProjectFormValues) {
    try {
      const created = await createProject.mutateAsync({
        practicalTaskSubmissionId: values.practicalTaskSubmissionId,
        title: values.title,
        description: values.description || undefined,
        technologies: values.technologies
          ? values.technologies
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        skillsAcquired: values.skillsAcquired
          ? values.skillsAcquired
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        repositoryUrl: values.repositoryUrl || undefined,
        liveDemoUrl: values.liveDemoUrl || undefined,
        completionDate: new Date(values.completionDate).toISOString(),
      });
      navigate(`/portal/portfolio/${created.id}`);
    } catch {
      // surfaced below via createProject.error
    }
  }

  const errorMessage = createProject.error instanceof ApiError ? createProject.error.message : null;

  return (
    <div>
      <AdminPageHeader
        title="New portfolio project"
        description="Feature a submitted practical task."
      />
      <Card>
        <CardHeader>
          <CardTitle as="h2">Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {errorMessage ? (
              <Alert variant="danger" className="w-full">
                {errorMessage}
              </Alert>
            ) : null}

            <SelectField
              label="Source task"
              fullWidth
              error={form.formState.errors.practicalTaskSubmissionId?.message}
              defaultValue={eligibleTasks[0]?.submission?.id ?? ''}
              {...form.register('practicalTaskSubmissionId')}
              onChange={(event) => {
                form.setValue('practicalTaskSubmissionId', event.target.value);
                const task = eligibleTasks.find((t) => t.submission?.id === event.target.value);
                if (task && !form.getValues('title')) {
                  form.setValue('title', task.title);
                }
              }}
            >
              {eligibleTasks.map((task) => (
                <option key={task.id} value={task.submission?.id}>
                  {task.title} (Week {task.weekNumber})
                </option>
              ))}
            </SelectField>

            <FormField
              label="Title"
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <FormField
              label="Technologies (comma-separated)"
              error={form.formState.errors.technologies?.message}
              {...form.register('technologies')}
            />
            <FormField
              label="Skills acquired (comma-separated)"
              error={form.formState.errors.skillsAcquired?.message}
              {...form.register('skillsAcquired')}
            />
            <FormField
              label="Repository URL"
              type="url"
              error={form.formState.errors.repositoryUrl?.message}
              {...form.register('repositoryUrl')}
            />
            <FormField
              label="Live demo URL"
              type="url"
              error={form.formState.errors.liveDemoUrl?.message}
              {...form.register('liveDemoUrl')}
            />
            <FormField
              label="Completion date"
              type="date"
              error={form.formState.errors.completionDate?.message}
              {...form.register('completionDate')}
            />
            <TextareaField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />

            <div className="flex w-full justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={createProject.isPending}>
                Create project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
