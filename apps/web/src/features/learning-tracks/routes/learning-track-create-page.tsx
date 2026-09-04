import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { SelectField } from '@/components/select-field';
import { TextareaField } from '@/components/textarea-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useCreateLearningTrack } from '../hooks/use-learning-track-mutations';
import {
  createLearningTrackSchema,
  type CreateLearningTrackFormValues,
} from '../schemas/learning-track-schemas';

export function LearningTrackCreatePage() {
  const { fellowshipId } = useParams<{ fellowshipId: string }>();
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const createTrack = useCreateLearningTrack(fellowshipId ?? '');

  const form = useForm<CreateLearningTrackFormValues>({
    resolver: zodResolver(createLearningTrackSchema),
    defaultValues: { difficulty: 'beginner' },
  });

  if (!activeOrganizationId || !fellowshipId) return null;

  async function onSubmit(values: CreateLearningTrackFormValues) {
    try {
      const created = await createTrack.mutateAsync({
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        difficulty: values.difficulty,
        estimatedWeeks: values.estimatedWeeks ? Number(values.estimatedWeeks) : undefined,
        learningOutcomes: values.learningOutcomes
          ? values.learningOutcomes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        tags: values.tags
          ? values.tags
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      });
      navigate(`/admin/tracks/${created.id}`);
    } catch {
      // surfaced below via createTrack.error
    }
  }

  const errorMessage = createTrack.error instanceof ApiError ? createTrack.error.message : null;

  return (
    <div>
      <AdminPageHeader
        title="New learning track"
        description="Add a structured path to this fellowship."
      />
      <Card>
        <CardHeader>
          <CardTitle as="h2">Track details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {errorMessage ? (
              <Alert variant="danger" className="w-full">
                {errorMessage}
              </Alert>
            ) : null}
            <FormField
              label="Name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <FormField
              label="URL slug"
              error={form.formState.errors.slug?.message}
              {...form.register('slug')}
            />
            <SelectField
              label="Difficulty"
              error={form.formState.errors.difficulty?.message}
              {...form.register('difficulty')}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </SelectField>
            <FormField
              label="Estimated weeks"
              type="number"
              error={form.formState.errors.estimatedWeeks?.message}
              {...form.register('estimatedWeeks')}
            />
            <FormField
              label="Learning outcomes (comma-separated)"
              error={form.formState.errors.learningOutcomes?.message}
              {...form.register('learningOutcomes')}
            />
            <FormField
              label="Tags (comma-separated)"
              error={form.formState.errors.tags?.message}
              {...form.register('tags')}
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
              <Button type="submit" loading={createTrack.isPending}>
                Create track
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
