import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { useAcademyOptions } from '@/features/academies';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useCreateFellowship } from '../hooks/use-fellowship-mutations';
import {
  createFellowshipSchema,
  type CreateFellowshipFormValues,
} from '../schemas/fellowship-schemas';

export function FellowshipCreatePage() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const academyOptions = useAcademyOptions();
  const createFellowship = useCreateFellowship();
  const form = useForm<CreateFellowshipFormValues>({
    resolver: zodResolver(createFellowshipSchema),
  });

  async function onSubmit(values: CreateFellowshipFormValues) {
    try {
      const created = await createFellowship.mutateAsync({
        academyId: values.academyId,
        title: values.title,
        slug: values.slug,
        durationWeeks: values.durationWeeks,
        summary: values.summary || undefined,
        description: values.description || undefined,
        defaultCapacity: values.defaultCapacity ? Number(values.defaultCapacity) : undefined,
        isPublic: values.isPublic,
      });
      navigate(`/admin/fellowships/${created.id}`);
    } catch {
      // surfaced below via createFellowship.error
    }
  }

  const apiErrorMessage =
    createFellowship.error instanceof ApiError ? createFellowship.error.message : null;

  if (!activeOrganizationId) {
    return <p className="text-sm text-muted-foreground">Select an organization first.</p>;
  }

  return (
    <div>
      <AdminPageHeader
        title="New fellowship"
        description="Define a reusable fellowship programme."
      />
      <Card className="max-w-xl">
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {apiErrorMessage ? <Alert variant="danger">{apiErrorMessage}</Alert> : null}
            <div className="space-y-1.5">
              <Label htmlFor="academyId">Academy</Label>
              <Select id="academyId" {...form.register('academyId')}>
                <option value="">Select an academy…</option>
                {academyOptions.data?.items.map((academy) => (
                  <option key={academy.id} value={academy.id}>
                    {academy.name}
                  </option>
                ))}
              </Select>
              {form.formState.errors.academyId ? (
                <p className="text-sm text-danger">{form.formState.errors.academyId.message}</p>
              ) : null}
            </div>
            <FormField
              label="Title"
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <FormField
              label="Slug"
              placeholder="frontend-development"
              error={form.formState.errors.slug?.message}
              {...form.register('slug')}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Duration (weeks)"
                type="number"
                min={1}
                max={52}
                error={form.formState.errors.durationWeeks?.message}
                {...form.register('durationWeeks')}
              />
              <FormField
                label="Default capacity"
                type="number"
                min={1}
                error={form.formState.errors.defaultCapacity?.message}
                {...form.register('defaultCapacity')}
              />
            </div>
            <FormField
              label="Summary"
              error={form.formState.errors.summary?.message}
              {...form.register('summary')}
            />
            <FormField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="flex items-center gap-2">
              <input
                id="isPublic"
                type="checkbox"
                className="size-4 rounded border-border"
                {...form.register('isPublic')}
              />
              <Label htmlFor="isPublic">Visible in the public catalogue</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/admin/fellowships')}
              >
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Create fellowship
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
