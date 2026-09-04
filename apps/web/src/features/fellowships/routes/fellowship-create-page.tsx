import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Breadcrumb } from '@/components/admin/breadcrumb';
import { useAcademy, useAcademyOptions } from '@/features/academies';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { ReadOnlyField } from '@/components/read-only-field';
import { SelectField } from '@/components/select-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useCreateFellowship } from '../hooks/use-fellowship-mutations';
import {
  createFellowshipSchema,
  type CreateFellowshipFormValues,
} from '../schemas/fellowship-schemas';

export function FellowshipCreatePage() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  // Arriving from an Academy's own "Fellowships" section carries the academy
  // as context (?academyId=) so the academy never has to be picked from a
  // flat, org-wide dropdown — see docs/adr/0012-hierarchy-provisioning.md.
  const [searchParams] = useSearchParams();
  const contextAcademyId = searchParams.get('academyId') || undefined;
  const contextAcademy = useAcademy(contextAcademyId);
  const academyOptions = useAcademyOptions();
  const createFellowship = useCreateFellowship();
  const form = useForm<CreateFellowshipFormValues>({
    resolver: zodResolver(createFellowshipSchema),
    defaultValues: { academyId: contextAcademyId ?? '' },
  });

  useEffect(() => {
    if (contextAcademyId) form.setValue('academyId', contextAcademyId);
  }, [contextAcademyId, form]);

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
        description={
          contextAcademy.data ? (
            <Breadcrumb
              items={[
                { label: 'Organizations', to: '/admin/organizations' },
                {
                  label: contextAcademy.data.name,
                  to: `/admin/academies/${contextAcademy.data.id}`,
                },
                { label: 'New fellowship' },
              ]}
            />
          ) : (
            'Define a reusable fellowship programme.'
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
            {contextAcademyId ? (
              <>
                <ReadOnlyField label="Academy" value={contextAcademy.data?.name ?? 'Loading…'} />
                <input type="hidden" {...form.register('academyId')} />
              </>
            ) : (
              <SelectField
                label="Academy"
                error={form.formState.errors.academyId?.message}
                {...form.register('academyId')}
              >
                <option value="">Select an academy…</option>
                {academyOptions.data?.items.map((academy) => (
                  <option key={academy.id} value={academy.id}>
                    {academy.name}
                  </option>
                ))}
              </SelectField>
            )}
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
            <div className="flex w-full items-center gap-2">
              <input
                id="isPublic"
                type="checkbox"
                className="size-4 rounded border-border"
                {...form.register('isPublic')}
              />
              <Label htmlFor="isPublic">Visible in the public catalogue</Label>
            </div>
            <div className="flex w-full justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  navigate(
                    contextAcademyId
                      ? `/admin/academies/${contextAcademyId}`
                      : '/admin/fellowships',
                  )
                }
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
