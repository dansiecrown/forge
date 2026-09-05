import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest, ApiError } from '@/api/client';
import { ActionsMenu, type ActionsMenuItem } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Breadcrumb } from '@/components/admin/breadcrumb';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { DefinitionList } from '@/components/admin/definition-list';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { useToast } from '@/components/ui/toast';
import { useActiveOrganization } from '@/contexts/organization-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useAcademiesList } from '@/features/academies';
import type { Academy, OrganizationAdmin } from '@forge/api-contract';
import {
  useOrganizationLifecycleActions,
  useUpdateOrganization,
} from '../hooks/use-organization-mutations';
import { useOrganization } from '../hooks/use-organizations';
import {
  updateOrganizationSchema,
  type UpdateOrganizationFormValues,
} from '../schemas/organization-schemas';

const ACADEMY_STATUS_TONE: Record<string, BadgeProps['tone']> = {
  active: 'success',
  archived: 'danger',
};

const academyColumns: DataTableColumn<Academy>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  { key: 'slug', header: 'Slug', render: (row) => row.slug },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={ACADEMY_STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
];

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  provisioning: 'neutral',
  active: 'success',
  suspended: 'warning',
  archived: 'danger',
};

export function OrganizationDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganization();
  // Visiting an organization's own detail page makes it the active tenant
  // context for the rest of the session's navigation — the missing link that
  // lets a Super Admin actually drill Organization -> Academy -> Fellowship
  // -> Cohort across organizations other than whichever one their org
  // switcher last had selected. Every hook below this point that needs an
  // "X-Organization-Id" for a call scoped to *this* organization uses `orgId`
  // directly (not `activeOrganizationId`) so this page's own data is never
  // stale for the one render before the effect below catches up.
  useEffect(() => {
    if (orgId && orgId !== activeOrganizationId) setActiveOrganizationId(orgId);
  }, [orgId, activeOrganizationId, setActiveOrganizationId]);

  const { data: organization, isLoading, error } = useOrganization(orgId, orgId);
  const updateOrganization = useUpdateOrganization(orgId ?? '', orgId);
  const { suspend, archive, restore } = useOrganizationLifecycleActions(orgId ?? '');
  const [pendingAction, setPendingAction] = useState<'suspend' | 'archive' | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const toast = useToast();
  const permissions = usePermissions();
  const stats = useQuery({
    queryKey: ['admin-organization-stats', orgId],
    queryFn: () =>
      apiRequest<{
        academyCount: number;
        fellowshipCount: number;
        cohortCount: number;
        enrollmentCount: number;
        certificatesIssued: number;
      }>(`/admin/organizations/${orgId}/stats`, { organizationId: orgId }),
    enabled: Boolean(orgId),
  });
  const admins = useQuery({
    queryKey: ['admin-organization-admins', orgId],
    queryFn: () =>
      apiRequest<OrganizationAdmin[]>(`/organizations/${orgId}/admins`, {
        organizationId: orgId,
      }),
    enabled: Boolean(orgId),
  });
  const academies = useAcademiesList('', '');

  const form = useForm<UpdateOrganizationFormValues>({
    resolver: zodResolver(updateOrganizationSchema),
  });

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
      toast.success('Organization profile updated.');
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update organization.');
      // Also surfaced inline below (updateOrganization.error) while the dialog stays open.
    }
  }

  async function onConfirmAction(reason?: string) {
    try {
      if (pendingAction === 'suspend') await suspend.mutateAsync(reason ?? '');
      if (pendingAction === 'archive') await archive.mutateAsync(reason ?? '');
      setPendingAction(null);
    } catch {
      // surfaced below via suspend.error / archive.error
    }
  }

  const updateErrorMessage =
    updateOrganization.error instanceof ApiError ? updateOrganization.error.message : null;

  const lifecycleItems: ActionsMenuItem[] = [];
  if (organization.status === 'active' && permissions.has('organization.suspend')) {
    lifecycleItems.push({ label: 'Suspend', onSelect: () => setPendingAction('suspend') });
  }
  if (organization.status !== 'archived' && permissions.has('organization.archive')) {
    lifecycleItems.push({
      label: 'Archive',
      tone: 'danger',
      onSelect: () => setPendingAction('archive'),
    });
  }
  if (organization.status === 'archived' && permissions.has('organization.restore')) {
    lifecycleItems.push({
      label: 'Restore',
      loading: restore.isPending,
      onSelect: () => restore.mutate(),
    });
  }
  if (organization.status === 'suspended' && permissions.has('organization.restore')) {
    lifecycleItems.push({
      label: 'Reactivate',
      loading: restore.isPending,
      onSelect: () => restore.mutate(),
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={organization.name}
        description={
          <Breadcrumb
            items={[
              { label: 'Organizations', to: '/admin/organizations' },
              { label: organization.name },
            ]}
          />
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[organization.status]}>{organization.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />
      {!permissions.has('organization.suspend') && !permissions.has('organization.archive') ? (
        <p className="text-sm text-muted-foreground">
          Your role can view this organization but not change its lifecycle status.
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle as="h2">Profile</CardTitle>
          {permissions.has('organization.update') ? (
            <Button
              variant="secondary"
              onClick={() => setEditOpen(true)}
              aria-label="Edit organization profile"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <DefinitionList
            items={[
              { label: 'Name', value: organization.name },
              { label: 'Legal name', value: organization.legalName },
              { label: 'Default timezone', value: organization.defaultTimezone },
              { label: 'Country', value: organization.country },
              { label: 'Support email', value: organization.supportEmail },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit organization profile">
        <form className="flex flex-wrap gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {updateErrorMessage ? (
            <Alert variant="danger" className="w-full">
              {updateErrorMessage}
            </Alert>
          ) : null}
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
          <FormField
            label="Support email"
            type="email"
            error={form.formState.errors.supportEmail?.message}
            {...form.register('supportEmail')}
          />
          <div className="flex w-full justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateOrganization.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle as="h2">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.data ? (
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Academies</dt>
                  <dd className="text-lg font-semibold text-foreground">
                    {stats.data.academyCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fellowships</dt>
                  <dd className="text-lg font-semibold text-foreground">
                    {stats.data.fellowshipCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cohorts</dt>
                  <dd className="text-lg font-semibold text-foreground">
                    {stats.data.cohortCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Enrollments</dt>
                  <dd className="text-lg font-semibold text-foreground">
                    {stats.data.enrollmentCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Certificates issued</dt>
                  <dd className="text-lg font-semibold text-foreground">
                    {stats.data.certificatesIssued}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Loading statistics…</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle as="h2">Organization administrators</CardTitle>
          </CardHeader>
          <CardContent>
            {admins.data && admins.data.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {admins.data.map((admin) => (
                  <li key={admin.id} className="truncate">
                    <span className="font-medium text-foreground">{admin.displayName}</span>{' '}
                    <span className="text-xs text-muted-foreground">{admin.email}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No organization admins assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle as="h2">Academies</CardTitle>
          {permissions.has('academy.create') ? (
            <Button variant="secondary" onClick={() => navigate('/admin/academies/new')}>
              <Plus className="size-4" aria-hidden="true" />
              New academy
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <DataTable
            columns={academyColumns}
            rows={academies.rows}
            rowKey={(row) => row.id}
            isLoading={academies.isLoading}
            error={academies.error}
            emptyTitle="No academies yet"
            emptyDescription="Create an academy to start organizing fellowships under this organization."
            onRowClick={(row) => navigate(`/admin/academies/${row.id}`)}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={onConfirmAction}
        loading={suspend.isPending || archive.isPending}
        error={
          pendingAction === 'suspend' && suspend.error instanceof ApiError
            ? suspend.error.message
            : pendingAction === 'archive' && archive.error instanceof ApiError
              ? archive.error.message
              : null
        }
        title={
          pendingAction === 'suspend' ? 'Suspend this organization?' : 'Archive this organization?'
        }
        description="This affects every academy, fellowship, and person in it. State why for the audit trail."
        reasonLabel={`Reason to ${pendingAction ?? 'suspend'} this organization`}
        confirmLabel={pendingAction === 'suspend' ? 'Suspend' : 'Archive'}
      />
    </div>
  );
}
