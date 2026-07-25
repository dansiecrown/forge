import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useFellowshipOptions } from '@/features/fellowships';
import { useCreateCohort } from '../hooks/use-cohort-mutations';
import { createCohortSchema, type CreateCohortFormValues } from '../schemas/cohort-schemas';

export function CohortCreatePage() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const fellowshipOptions = useFellowshipOptions();
  const createCohort = useCreateCohort();
  const form = useForm<CreateCohortFormValues>({ resolver: zodResolver(createCohortSchema) });

  async function onSubmit(values: CreateCohortFormValues) {
    try {
      const created = await createCohort.mutateAsync({
        fellowshipId: values.fellowshipId,
        name: values.name,
        slug: values.slug,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: new Date(values.endsAt).toISOString(),
        timezone: values.timezone,
        capacity: values.capacity,
        description: values.description || undefined,
      });
      navigate(`/admin/cohorts/${created.id}`);
    } catch {
      // surfaced below via createCohort.error
    }
  }

  const apiErrorMessage =
    createCohort.error instanceof ApiError ? createCohort.error.message : null;

  if (!activeOrganizationId) {
    return <p className="text-sm text-muted-foreground">Select an organization first.</p>;
  }

  return (
    <div>
      <AdminPageHeader
        title="New cohort"
        description="Schedule a dated delivery run of a fellowship."
      />
      <Card className="max-w-xl">
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {apiErrorMessage ? <Alert variant="danger">{apiErrorMessage}</Alert> : null}
            <div className="space-y-1.5">
              <Label htmlFor="fellowshipId">Fellowship</Label>
              <Select id="fellowshipId" {...form.register('fellowshipId')}>
                <option value="">Select a fellowship…</option>
                {fellowshipOptions.data?.items.map((fellowship) => (
                  <option key={fellowship.id} value={fellowship.id}>
                    {fellowship.title}
                  </option>
                ))}
              </Select>
              {form.formState.errors.fellowshipId ? (
                <p className="text-sm text-danger">{form.formState.errors.fellowshipId.message}</p>
              ) : null}
            </div>
            <FormField
              label="Name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <FormField
              label="Slug"
              placeholder="cohort-2027"
              error={form.formState.errors.slug?.message}
              {...form.register('slug')}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Starts at"
                type="datetime-local"
                error={form.formState.errors.startsAt?.message}
                {...form.register('startsAt')}
              />
              <FormField
                label="Ends at"
                type="datetime-local"
                error={form.formState.errors.endsAt?.message}
                {...form.register('endsAt')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Timezone"
                placeholder="Africa/Lagos"
                error={form.formState.errors.timezone?.message}
                {...form.register('timezone')}
              />
              <FormField
                label="Capacity"
                type="number"
                min={1}
                error={form.formState.errors.capacity?.message}
                {...form.register('capacity')}
              />
            </div>
            <FormField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/cohorts')}>
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Create cohort
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
