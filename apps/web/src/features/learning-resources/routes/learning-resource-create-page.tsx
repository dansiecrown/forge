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
import { useCreateLearningResource } from '../hooks/use-learning-resource-mutations';
import {
  createLearningResourceSchema,
  type CreateLearningResourceFormValues,
} from '../schemas/learning-resource-schemas';

export function LearningResourceCreatePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const createResource = useCreateLearningResource(moduleId ?? '');

  const form = useForm<CreateLearningResourceFormValues>({
    resolver: zodResolver(createLearningResourceSchema),
    defaultValues: { resourceType: 'article' },
  });

  if (!activeOrganizationId || !moduleId) return null;

  async function onSubmit(values: CreateLearningResourceFormValues) {
    try {
      const created = await createResource.mutateAsync({
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
      });
      navigate(`/admin/learning-resources/${created.id}`);
    } catch {
      // surfaced below via createResource.error
    }
  }

  const errorMessage =
    createResource.error instanceof ApiError ? createResource.error.message : null;

  return (
    <div>
      <AdminPageHeader
        title="New learning resource"
        description="Curate a resource for this weekly module."
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Resource details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
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
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={createResource.isPending}>
                Create resource
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
