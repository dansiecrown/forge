import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest, ApiError } from '@/api/client';
import { ActionsMenu, type ActionsMenuItem } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Breadcrumb } from '@/components/admin/breadcrumb';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { useActiveOrganization } from '@/contexts/organization-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useOrganization } from '@/features/organizations';
import { useFellowshipsList } from '@/features/fellowships';
import type { Fellowship } from '@forge/api-contract';
import { useAcademy } from '../hooks/use-academies';
import { useAcademyLifecycleActions, useUpdateAcademy } from '../hooks/use-academy-mutations';
import { updateAcademySchema, type UpdateAcademyFormValues } from '../schemas/academy-schemas';

const FELLOWSHIP_STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  retired: 'danger',
};

const fellowshipColumns: DataTableColumn<Fellowship>[] = [
  {
    key: 'title',
    header: 'Title',
    render: (row) => <span className="font-medium text-foreground">{row.title}</span>,
  },
  { key: 'slug', header: 'Slug', render: (row) => row.slug },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={FELLOWSHIP_STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
];

const STATUS_TONE: Record<string, BadgeProps['tone']> = { active: 'success', archived: 'danger' };

export function AcademyDetailPage() {
  const { academyId } = useParams<{ academyId: string }>();
  const navigate = useNavigate();
  const { data: academy, isLoading, error } = useAcademy(academyId);
  const updateAcademy = useUpdateAcademy(academyId ?? '');
  const { archive, restore } = useAcademyLifecycleActions(academyId ?? '');
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const { activeOrganizationId } = useActiveOrganization();
  const permissions = usePermissions();
  const organization = useOrganization(academy?.organizationId, academy?.organizationId);
  const fellowships = useFellowshipsList('', '', academyId);
  const stats = useQuery({
    queryKey: ['admin-academy-stats', academyId],
    queryFn: () =>
      apiRequest<{
        fellowshipCount: number;
        cohortCount: number;
        activeStudentCount: number;
        mentorCount: number;
        pendingReviewCount: number;
      }>(`/admin/academies/${academyId}/stats`, { organizationId: activeOrganizationId }),
    enabled: Boolean(academyId && activeOrganizationId),
  });

  const form = useForm<UpdateAcademyFormValues>({ resolver: zodResolver(updateAcademySchema) });

  useEffect(() => {
    if (academy) {
      form.reset({
        name: academy.name,
        timezone: academy.timezone,
        description: academy.description ?? '',
        contactEmail: academy.contactEmail ?? '',
        isPublic: academy.isPublic,
      });
    }
  }, [academy, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !academy) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Academy not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateAcademyFormValues) {
    if (!academy) return;
    try {
      await updateAcademy.mutateAsync({
        body: {
          name: values.name,
          timezone: values.timezone || undefined,
          description: values.description || undefined,
          contactEmail: values.contactEmail || undefined,
          isPublic: values.isPublic,
        },
        version: academy.version,
      });
    } catch {
      // surfaced below via updateAcademy.error
    }
  }

  async function onConfirmArchive(reason?: string) {
    try {
      await archive.mutateAsync(reason ?? '');
      setConfirmingArchive(false);
    } catch {
      // surfaced below via archive.error
    }
  }

  const updateErrorMessage =
    updateAcademy.error instanceof ApiError ? updateAcademy.error.message : null;

  const lifecycleItems: ActionsMenuItem[] = [];
  if (academy.status === 'active' && permissions.has('academy.archive')) {
    lifecycleItems.push({
      label: 'Archive',
      tone: 'danger',
      onSelect: () => setConfirmingArchive(true),
    });
  }
  if (academy.status === 'archived' && permissions.has('academy.restore')) {
    lifecycleItems.push({
      label: 'Restore',
      loading: restore.isPending,
      onSelect: () => restore.mutate(),
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={academy.name}
        description={
          <Breadcrumb
            items={[
              { label: 'Organizations', to: '/admin/organizations' },
              ...(organization.data
                ? [
                    {
                      label: organization.data.name,
                      to: `/admin/organizations/${organization.data.id}`,
                    },
                  ]
                : []),
              { label: academy.name },
            ]}
          />
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[academy.status]}>{academy.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />
      {!permissions.has('academy.archive') && !permissions.has('academy.restore') ? (
        <p className="text-sm text-muted-foreground">
          Your role can view this academy but not change its lifecycle status.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Profile</CardTitle>
        </CardHeader>
        <CardContent>
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
              label="Timezone"
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
            <div className="flex w-full items-center gap-2">
              <input
                id="isPublic"
                type="checkbox"
                className="size-4 rounded border-border"
                {...form.register('isPublic')}
              />
              <Label htmlFor="isPublic">Visible in the public catalogue</Label>
            </div>
            <div className="flex w-full justify-end pt-2">
              <Button type="submit" loading={updateAcademy.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.data ? (
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Fellowships</dt>
                <dd className="text-lg font-semibold text-foreground">
                  {stats.data.fellowshipCount}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cohorts</dt>
                <dd className="text-lg font-semibold text-foreground">{stats.data.cohortCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Active students</dt>
                <dd className="text-lg font-semibold text-foreground">
                  {stats.data.activeStudentCount}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mentors</dt>
                <dd className="text-lg font-semibold text-foreground">{stats.data.mentorCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pending reviews</dt>
                <dd className="text-lg font-semibold text-foreground">
                  {stats.data.pendingReviewCount}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Loading statistics…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle as="h2">Fellowships</CardTitle>
          {permissions.has('fellowship.create') ? (
            <Button
              variant="secondary"
              onClick={() => navigate(`/admin/fellowships/new?academyId=${academy.id}`)}
            >
              <Plus className="size-4" aria-hidden="true" />
              New fellowship
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <DataTable
            columns={fellowshipColumns}
            rows={fellowships.rows}
            rowKey={(row) => row.id}
            isLoading={fellowships.isLoading}
            error={fellowships.error}
            emptyTitle="No fellowships yet"
            emptyDescription="Create a fellowship programme to start scheduling cohorts under this academy."
            onRowClick={(row) => navigate(`/admin/fellowships/${row.id}`)}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmingArchive}
        onClose={() => setConfirmingArchive(false)}
        onConfirm={onConfirmArchive}
        loading={archive.isPending}
        error={archive.error instanceof ApiError ? archive.error.message : null}
        title="Archive this academy?"
        description="This affects every fellowship, cohort, and person in it. State why for the audit trail."
        reasonLabel="Reason to archive this academy"
        confirmLabel="Archive"
      />
    </div>
  );
}
