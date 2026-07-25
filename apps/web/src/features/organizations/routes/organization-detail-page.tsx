import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  useOrganizationLifecycleActions,
  useUpdateOrganization,
} from '../hooks/use-organization-mutations';
import { useOrganization } from '../hooks/use-organizations';
import {
  actionReasonSchema,
  updateOrganizationSchema,
  type ActionReasonFormValues,
  type UpdateOrganizationFormValues,
} from '../schemas/organization-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  provisioning: 'neutral',
  active: 'success',
  suspended: 'warning',
  archived: 'danger',
};

export function OrganizationDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { activeOrganizationId } = useActiveOrganization();
  const { data: organization, isLoading, error } = useOrganization(orgId, activeOrganizationId);
  const updateOrganization = useUpdateOrganization(orgId ?? '', activeOrganizationId);
  const { suspend, archive, restore } = useOrganizationLifecycleActions(orgId ?? '');
  const [pendingAction, setPendingAction] = useState<'suspend' | 'archive' | null>(null);

  const form = useForm<UpdateOrganizationFormValues>({
    resolver: zodResolver(updateOrganizationSchema),
  });
  const reasonForm = useForm<ActionReasonFormValues>({ resolver: zodResolver(actionReasonSchema) });

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name,
        legalName: organization.legalName ?? '',
        defaultTimezone: organization.defaultTimezone,
        country: organization.country ?? '',
        supportEmail: organization.supportEmail ?? '',
      });
    }
  }, [organization, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Organization not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateOrganizationFormValues) {
    if (!organization) return;
    try {
      await updateOrganization.mutateAsync({
        body: {
          name: values.name,
          legalName: values.legalName || undefined,
          defaultTimezone: values.defaultTimezone || undefined,
          country: values.country || undefined,
          supportEmail: values.supportEmail || undefined,
        },
        version: organization.version,
      });
    } catch {
      // surfaced below via updateOrganization.error
    }
  }

  async function onConfirmAction(values: ActionReasonFormValues) {
    if (pendingAction === 'suspend') await suspend.mutateAsync(values.reason);
    if (pendingAction === 'archive') await archive.mutateAsync(values.reason);
    setPendingAction(null);
    reasonForm.reset();
  }

  const updateErrorMessage =
    updateOrganization.error instanceof ApiError ? updateOrganization.error.message : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={organization.name}
        description={
          <>
            <Link to="/admin/organizations" className="text-brand hover:underline">
              Organizations
            </Link>{' '}
            / {organization.slug}
          </>
        }
        action={<Badge tone={STATUS_TONE[organization.status]}>{organization.status}</Badge>}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {updateErrorMessage ? <Alert variant="danger">{updateErrorMessage}</Alert> : null}
            <FormField
              label="Name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <FormField
              label="Legal name"
              error={form.formState.errors.legalName?.message}
              {...form.register('legalName')}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Default timezone"
                error={form.formState.errors.defaultTimezone?.message}
                {...form.register('defaultTimezone')}
              />
              <FormField
                label="Country (ISO code)"
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
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={updateOrganization.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingAction ? (
            <form
              className="space-y-3"
              onSubmit={reasonForm.handleSubmit(onConfirmAction)}
              noValidate
            >
              <FormField
                label={`Reason to ${pendingAction} this organization`}
                autoFocus
                error={reasonForm.formState.errors.reason?.message}
                {...reasonForm.register('reason')}
              />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setPendingAction(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  loading={suspend.isPending || archive.isPending}
                >
                  Confirm {pendingAction}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-3">
              {organization.status === 'active' ? (
                <Button variant="secondary" onClick={() => setPendingAction('suspend')}>
                  Suspend
                </Button>
              ) : null}
              {organization.status !== 'archived' ? (
                <Button variant="destructive" onClick={() => setPendingAction('archive')}>
                  Archive
                </Button>
              ) : null}
              {organization.status === 'archived' ? (
                <Button
                  variant="secondary"
                  loading={restore.isPending}
                  onClick={() => restore.mutate()}
                >
                  Restore
                </Button>
              ) : null}
              {organization.status === 'suspended' ? (
                <Button
                  variant="secondary"
                  loading={restore.isPending}
                  onClick={() => restore.mutate()}
                >
                  Reactivate
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
