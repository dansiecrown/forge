import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { TextareaField } from '@/components/textarea-field';
import {
  usePortfolioProject,
  usePortfolioProjectActions,
  useUpdatePortfolioProject,
} from '../hooks/use-portfolio';
import {
  updatePortfolioProjectSchema,
  type UpdatePortfolioProjectFormValues,
} from '../schemas/portfolio-schemas';

export function PortfolioProjectEditPage() {
  const { id } = useParams<{ id: string }>();
  const project = usePortfolioProject(id);
  const updateProject = useUpdatePortfolioProject(id ?? '');
  const { publish, unpublish, remove } = usePortfolioProjectActions(id ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const form = useForm<UpdatePortfolioProjectFormValues>({
    resolver: zodResolver(updatePortfolioProjectSchema),
  });

  useEffect(() => {
    if (project) {
      form.reset({
        title: project.title,
        description: project.description ?? '',
        technologies: project.technologies.join(', '),
        skillsAcquired: project.skillsAcquired.join(', '),
        repositoryUrl: project.repositoryUrl ?? '',
        liveDemoUrl: project.liveDemoUrl ?? '',
        completionDate: project.completionDate.slice(0, 10),
      });
    }
  }, [project, form]);

  if (!project) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  async function onSubmit(values: UpdatePortfolioProjectFormValues) {
    if (!project) return;
    try {
      await updateProject.mutateAsync({
        body: {
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
        },
        version: project.version,
      });
    } catch {
      // surfaced below via updateProject.error
    }
  }

  const errorMessage = updateProject.error instanceof ApiError ? updateProject.error.message : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={project.title}
        action={
          <Badge tone={project.visibility === 'public' ? 'success' : 'neutral'}>
            {project.visibility}
          </Badge>
        }
      />

      {project.visibility === 'public' && project.publicSlug ? (
        <Card className="flex items-center gap-2 py-4">
          <span className="truncate text-sm text-muted-foreground">
            {`https://forge.example/p/${project.publicSlug}`}
          </span>
          <button
            type="button"
            aria-label="Copy public link"
            onClick={() =>
              void navigator.clipboard?.writeText(`https://forge.example/p/${project.publicSlug}`)
            }
            className="text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-4" aria-hidden="true" />
          </button>
          <span className="ml-2 text-xs text-muted-foreground">
            (preview only — public link not yet live)
          </span>
        </Card>
      ) : null}

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
            <div className="flex w-full justify-end pt-2">
              <Button type="submit" loading={updateProject.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {project.visibility === 'private' ? (
              <Button loading={publish.isPending} onClick={() => publish.mutate(project.version)}>
                Publish
              </Button>
            ) : (
              <Button
                variant="secondary"
                loading={unpublish.isPending}
                onClick={() => unpublish.mutate(project.version)}
              >
                Unpublish
              </Button>
            )}
            <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(project.version);
            setConfirmingDelete(false);
          } catch {
            // surfaced below via remove.error
          }
        }}
        loading={remove.isPending}
        error={remove.error instanceof ApiError ? remove.error.message : null}
        title="Delete this project?"
        description="It will no longer appear in your portfolio."
        confirmLabel="Delete"
      />
    </div>
  );
}
