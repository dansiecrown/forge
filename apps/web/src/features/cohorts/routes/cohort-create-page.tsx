import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Breadcrumb } from '@/components/admin/breadcrumb';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { ReadOnlyField } from '@/components/read-only-field';
import { SelectField } from '@/components/select-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useFellowship, useFellowshipOptions } from '@/features/fellowships';
import { useCreateCohort } from '../hooks/use-cohort-mutations';
import { createCohortSchema, type CreateCohortFormValues } from '../schemas/cohort-schemas';

export function CohortCreatePage() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  // Arriving from a Fellowship's own "Cohorts" section carries the
  // fellowship as context (?fellowshipId=) so it never has to be picked from
  // a flat, org-wide dropdown — see docs/adr/0012-hierarchy-provisioning.md.
  const [searchParams] = useSearchParams();
  const contextFellowshipId = searchParams.get('fellowshipId') || undefined;
  const contextFellowship = useFellowship(contextFellowshipId);
  const fellowshipOptions = useFellowshipOptions();
  const createCohort = useCreateCohort();
  const form = useForm<CreateCohortFormValues>({
    resolver: zodResolver(createCohortSchema),
    defaultValues: { fellowshipId: contextFellowshipId ?? '' },
  });

  useEffect(() => {
    if (contextFellowshipId) form.setValue('fellowshipId', contextFellowshipId);
  }, [contextFellowshipId, form]);

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
        description={
          contextFellowship.data ? (
            <Breadcrumb
              items={[
                { label: 'Organizations', to: '/admin/organizations' },
                {
                  label: contextFellowship.data.title,
                  to: `/admin/fellowships/${contextFellowship.data.id}`,
                },
                { label: 'New cohort' },
              ]}
            />
          ) : (
            'Schedule a dated delivery run of a fellowship.'
          )
        }
      />
      <Card>
        <CardContent>
          <form className="flex flex-wrap gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {apiErrorMessage ? (
              <Alert variant="danger" className="w-full">
                {apiErrorMessage}
              </Alert>
            ) : null}
            {contextFellowshipId ? (
              <>
                <ReadOnlyField
                  label="Fellowship"
                  value={contextFellowship.data?.title ?? 'Loading…'}
                />
                <input type="hidden" {...form.register('fellowshipId')} />
              </>
            ) : (
              <SelectField
                label="Fellowship"
                error={form.formState.errors.fellowshipId?.message}
                {...form.register('fellowshipId')}
              >
                <option value="">Select a fellowship…</option>
                {fellowshipOptions.data?.items.map((fellowship) => (
                  <option key={fellowship.id} value={fellowship.id}>
                    {fellowship.title}
                  </option>
                ))}
              </SelectField>
            )}
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
            <FormField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="flex w-full justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  navigate(
                    contextFellowshipId
                      ? `/admin/fellowships/${contextFellowshipId}`
                      : '/admin/cohorts',
                  )
                }
              >
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
