import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { useCreateOrganization } from '../hooks/use-organization-mutations';
import {
  createOrganizationSchema,
  type CreateOrganizationFormValues,
} from '../schemas/organization-schemas';

export function OrganizationCreatePage() {
  const navigate = useNavigate();
  const createOrganization = useCreateOrganization();
  const form = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationSchema),
  });

  async function onSubmit(values: CreateOrganizationFormValues) {
    try {
      const created = await createOrganization.mutateAsync({
        name: values.name,
        slug: values.slug,
        legalName: values.legalName || undefined,
        defaultTimezone: values.defaultTimezone || undefined,
        country: values.country || undefined,
        supportEmail: values.supportEmail || undefined,
      });
      navigate(`/admin/organizations/${created.id}`);
    } catch {
      // surfaced below via createOrganization.error
    }
  }

  const apiErrorMessage =
    createOrganization.error instanceof ApiError
      ? createOrganization.error.message
      : createOrganization.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <div>
      <AdminPageHeader title="New organization" description="Provision a new platform tenant." />
      <Card className="max-w-xl">
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {apiErrorMessage ? <Alert variant="danger">{apiErrorMessage}</Alert> : null}
            <FormField
              label="Name"
              autoFocus
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <FormField
              label="Slug"
              placeholder="tech-impact-fellowship"
              error={form.formState.errors.slug?.message}
              {...form.register('slug')}
            />
            <FormField
              label="Legal name"
              error={form.formState.errors.legalName?.message}
              {...form.register('legalName')}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Default timezone"
                placeholder="Africa/Lagos"
                error={form.formState.errors.defaultTimezone?.message}
                {...form.register('defaultTimezone')}
              />
              <FormField
                label="Country (ISO code)"
                placeholder="NG"
                maxLength={2}
                error={form.formState.errors.country?.message}
                {...form.register('country')}
              />
            </div>
            <FormField
              label="Support email"
              type="email"
              error={form.formState.errors.supportEmail?.message}
              {...form.register('supportEmail')}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/admin/organizations')}
              >
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Create organization
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
