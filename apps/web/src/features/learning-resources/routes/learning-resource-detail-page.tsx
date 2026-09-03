import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Loader2 } from 'lucide-react';
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
import { Select } from '@/components/ui/select';
import { TextareaField } from '@/components/textarea-field';
import {
  useLearningResourceLifecycleActions,
  useUpdateLearningResource,
} from '../hooks/use-learning-resource-mutations';
import { useLearningResource } from '../hooks/use-learning-resources';
import {
  updateLearningResourceSchema,
  type UpdateLearningResourceFormValues,
} from '../schemas/learning-resource-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

export function LearningResourceDetailPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const { data: resource, isLoading, error } = useLearningResource(resourceId);
  const updateResource = useUpdateLearningResource(resourceId ?? '');
  const { publish, archive, restore } = useLearningResourceLifecycleActions(resourceId ?? '');
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const form = useForm<UpdateLearningResourceFormValues>({
    resolver: zodResolver(updateLearningResourceSchema),
  });

  useEffect(() => {
    if (resource) {
      form.reset({
        resourceType: resource.resourceType,
        title: resource.title,
        url: resource.url ?? '',
        author: resource.author ?? '',
        provider: resource.provider ?? '',
        estimatedDurationMinutes: resource.estimatedDurationMinutes ?? '',
        isRequired: resource.isRequired,
        notes: resource.notes ?? '',
      });
    }
  }, [resource, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !resource) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Learning resource not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateLearningResourceFormValues) {
    if (!resource) return;
    try {
      await updateResource.mutateAsync({
        body: {
          resourceType: values.resourceType,
          title: values.title,
          url: values.url || undefined,
          author: values.author || undefined,
          provider: values.provider || undefined,
          estimatedDurationMinutes: values.estimatedDurationMinutes
            ? Number(values.estimatedDurationMinutes)
            : undefined,
          isRequired: values.isRequired,
          notes: values.notes || undefined,
        },
        version: resource.version,
      });
    } catch {
      // surfaced below via updateResource.error
    }
  }

  const updateErrorMessage =
    updateResource.error instanceof ApiError ? updateResource.error.message : null;

  async function onConfirmArchive() {
    if (!resource) return;
    try {
      await archive.mutateAsync(resource.version);
      setConfirmingArchive(false);
    } catch {
      // surfaced below via archive.error
    }
  }

  const lifecycleItems = buildPublishLifecycleItems({
    status: resource.status,
    publishing: publish.isPending,
    restoring: restore.isPending,
    onPublish: () => publish.mutate(resource.version),
    onArchiveRequest: () => setConfirmingArchive(true),
    onRestore: () => restore.mutate(resource.version),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={resource.title}
        description={
          <Link
            to={`/admin/modules/${resource.weeklyModuleId}`}
            className="text-brand hover:underline"
          >
            Back to weekly module
          </Link>
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[resource.status]}>{resource.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Link2 className="size-5 text-muted-foreground" aria-hidden="true" />
            Resource details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {updateErrorMessage ? <Alert variant="danger">{updateErrorMessage}</Alert> : null}
            <FormField
              label="Title"
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <div className="space-y-1.5">
              <Label htmlFor="resourceType">Resource type</Label>
              <Select id="resourceType" {...form.register('resourceType')}>
                <option value="udemy_course">Udemy course</option>
                <option value="youtube_video">YouTube video</option>
                <option value="official_documentation">Official documentation</option>
                <option value="github_repository">GitHub repository</option>
                <option value="pdf">PDF</option>
                <option value="article">Article</option>
                <option value="book">Book</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <FormField
              label="URL"
              error={form.formState.errors.url?.message}
              {...form.register('url')}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Author"
                error={form.formState.errors.author?.message}
                {...form.register('author')}
              />
              <FormField
                label="Provider"
                error={form.formState.errors.provider?.message}
                {...form.register('provider')}
              />
            </div>
            <FormField
              label="Estimated duration (minutes)"
              type="number"
              error={form.formState.errors.estimatedDurationMinutes?.message}
              {...form.register('estimatedDurationMinutes')}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRequired"
                className="size-4 rounded border-border"
                {...form.register('isRequired')}
              />
              <Label htmlFor="isRequired">Required for progression</Label>
            </div>
            <TextareaField
              label="Notes"
              error={form.formState.errors.notes?.message}
              {...form.register('notes')}
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={updateResource.isPending}>
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
        title="Archive this resource?"
        description="You can restore it back to draft later if needed."
        confirmLabel="Archive"
      />
    </div>
  );
}
