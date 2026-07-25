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
import { useActiveOrganization } from '@/contexts/organization-context';
import { useCreateAcademy } from '../hooks/use-academy-mutations';
import { createAcademySchema, type CreateAcademyFormValues } from '../schemas/academy-schemas';

export function AcademyCreatePage() {
  const navigate = useNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const createAcademy = useCreateAcademy();
  const form = useForm<CreateAcademyFormValues>({ resolver: zodResolver(createAcademySchema) });

  async function onSubmit(values: CreateAcademyFormValues) {
    try {
      const created = await createAcademy.mutateAsync({
        name: values.name,
        slug: values.slug,
        timezone: values.timezone || undefined,
        description: values.description || undefined,
        contactEmail: values.contactEmail || undefined,
        isPublic: values.isPublic,
      });
      navigate(`/admin/academies/${created.id}`);
    } catch {
      // surfaced below via createAcademy.error
    }
  }

  const apiErrorMessage =
    createAcademy.error instanceof ApiError ? createAcademy.error.message : null;

  if (!activeOrganizationId) {
    return <p className="text-sm text-muted-foreground">Select an organization first.</p>;
  }

  return (
    <div>
      <AdminPageHeader
        title="New academy"
        description="Create a learning brand within this organization."
      />
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
              placeholder="school-of-technology"
              error={form.formState.errors.slug?.message}
              {...form.register('slug')}
            />
            <FormField
              label="Timezone"
              placeholder="Africa/Lagos"
              error={form.formState.errors.timezone?.message}
              {...form.register('timezone')}
            />
            <FormField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <FormField
              label="Contact email"
              type="email"
              error={form.formState.errors.contactEmail?.message}
              {...form.register('contactEmail')}
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
                onClick={() => navigate('/admin/academies')}
              >
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Create academy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
