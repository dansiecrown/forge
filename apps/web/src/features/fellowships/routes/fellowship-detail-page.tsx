import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap, Loader2, Pencil, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useActiveOrganization } from '@/contexts/organization-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useOrganization } from '@/features/organizations';
import { useAcademy } from '@/features/academies';
import { useCohortsList } from '@/features/cohorts';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import type { Cohort } from '@forge/api-contract';
import { duplicateFellowship } from '../api/fellowships-api';
import {
  useFellowshipLifecycleActions,
  useUpdateFellowship,
} from '../hooks/use-fellowship-mutations';
import { useFellowship } from '../hooks/use-fellowships';
import {
  updateFellowshipSchema,
  type UpdateFellowshipFormValues,
} from '../schemas/fellowship-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  retired: 'danger',
};

const COHORT_STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  enrolling: 'brand',
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
  archived: 'danger',
};

const cohortColumns: DataTableColumn<Cohort>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  {
    key: 'dates',
    header: 'Dates',
    render: (row) =>
      `${new Date(row.startsAt).toLocaleDateString()} – ${new Date(row.endsAt).toLocaleDateString()}`,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={COHORT_STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
];

export function FellowshipDetailPage() {
  const { fellowshipId } = useParams<{ fellowshipId: string }>();
  const navigate = useNavigate();
  const { data: fellowship, isLoading, error } = useFellowship(fellowshipId);
  const updateFellowship = useUpdateFellowship(fellowshipId ?? '');
  const { publish, retire } = useFellowshipLifecycleActions(fellowshipId ?? '');
  const [confirmingRetire, setConfirmingRetire] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const toast = useToast();
  const { activeOrganizationId } = useActiveOrganization();
  const permissions = usePermissions();
  const academy = useAcademy(fellowship?.academyId);
  const organization = useOrganization(fellowship?.organizationId, fellowship?.organizationId);
  const cohorts = useCohortsList('', '', fellowshipId);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState('');
  const [duplicateSlug, setDuplicateSlug] = useState('');
  const duplicate = useMutation({
    mutationFn: () =>
      duplicateFellowship(
        fellowshipId as string,
        { title: duplicateTitle, slug: duplicateSlug },
        activeOrganizationId,
      ),
    onSuccess: (cloned) => navigate(`/admin/fellowships/${cloned.id}`),
  });

  const form = useForm<UpdateFellowshipFormValues>({
    resolver: zodResolver(updateFellowshipSchema),
  });

  useEffect(() => {
    if (fellowship) {
      form.reset({
        title: fellowship.title,
        durationWeeks: fellowship.durationWeeks,
        summary: fellowship.summary ?? '',
        description: fellowship.description ?? '',
        defaultCapacity: fellowship.defaultCapacity ?? '',
        isPublic: fellowship.isPublic,
      });
    }
  }, [fellowship, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !fellowship) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Fellowship not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateFellowshipFormValues) {
    if (!fellowship) return;
    try {
      await updateFellowship.mutateAsync({
        body: {
          title: values.title,
          durationWeeks: values.durationWeeks,
          summary: values.summary || undefined,
          description: values.description || undefined,
          defaultCapacity: values.defaultCapacity ? Number(values.defaultCapacity) : undefined,
          isPublic: values.isPublic,
        },
        version: fellowship.version,
      });
      toast.success('Fellowship profile updated.');
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update fellowship.');
    }
  }

  const updateErrorMessage =
    updateFellowship.error instanceof ApiError ? updateFellowship.error.message : null;
  const isDraft = fellowship.status === 'draft';

  const lifecycleItems: ActionsMenuItem[] = [];
  if (fellowship.status === 'draft') {
    lifecycleItems.push({
      label: 'Publish',
      loading: publish.isPending,
      onSelect: () => publish.mutate(fellowship.version),
    });
  }
  if (fellowship.status === 'published') {
    lifecycleItems.push({
      label: 'Retire',
      tone: 'danger',
      onSelect: () => setConfirmingRetire(true),
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={fellowship.title}
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
              ...(academy.data
                ? [{ label: academy.data.name, to: `/admin/academies/${academy.data.id}` }]
                : []),
              { label: fellowship.title },
            ]}
          />
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[fellowship.status]}>{fellowship.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle as="h2" className="flex items-center gap-2">
            <GraduationCap className="size-5 text-muted-foreground" aria-hidden="true" />
            Programme details
          </CardTitle>
          {isDraft && permissions.has('fellowship.update') ? (
            <Button
              variant="secondary"
              onClick={() => setEditOpen(true)}
              aria-label="Edit programme details"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <DefinitionList
            items={[
              { label: 'Title', value: fellowship.title },
              { label: 'Duration (weeks)', value: fellowship.durationWeeks },
              { label: 'Default capacity', value: fellowship.defaultCapacity },
              { label: 'Summary', value: fellowship.summary },
              { label: 'Description', value: fellowship.description },
              { label: 'Visible in public catalogue', value: fellowship.isPublic ? 'Yes' : 'No' },
            ]}
          />
          {!isDraft ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Only draft fellowships can be edited.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit programme details">
        <form className="flex flex-wrap gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {updateErrorMessage ? (
            <Alert variant="danger" className="w-full">
              {updateErrorMessage}
            </Alert>
          ) : null}
          <FormField
            label="Title"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
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
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateFellowship.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Dialog>

      {fellowship.status === 'retired' ? (
        <p className="text-sm text-muted-foreground">This fellowship is retired.</p>
      ) : null}

      <ConfirmDialog
        open={confirmingRetire}
        onClose={() => setConfirmingRetire(false)}
        onConfirm={() => {
          retire.mutate(fellowship.version);
          setConfirmingRetire(false);
        }}
        loading={retire.isPending}
        error={retire.error instanceof ApiError ? retire.error.message : null}
        title="Retire this fellowship?"
        description="It can no longer be edited or have new cohorts created under it."
        confirmLabel="Retire"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Curriculum</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Learning Tracks structure this fellowship into courses, weekly modules, lessons,
              resources and practical tasks.
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate(`/admin/fellowships/${fellowship.id}/tracks`)}
            >
              Manage Learning Tracks
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Duplicate this fellowship</CardTitle>
            <p className="text-sm text-muted-foreground">
              Clones the entire curriculum tree into a new draft fellowship.
            </p>
          </CardHeader>
          <CardContent>
            {duplicate.error instanceof ApiError ? (
              <Alert variant="danger">{duplicate.error.message}</Alert>
            ) : null}
            {duplicating ? (
              <div className="space-y-3">
                <FormField
                  label="New title"
                  name="duplicateTitle"
                  autoFocus
                  value={duplicateTitle}
                  onChange={(e) => setDuplicateTitle(e.target.value)}
                />
                <FormField
                  label="New slug"
                  name="duplicateSlug"
                  value={duplicateSlug}
                  onChange={(e) => setDuplicateSlug(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setDuplicating(false)}>
                    Cancel
                  </Button>
                  <Button loading={duplicate.isPending} onClick={() => duplicate.mutate()}>
                    Duplicate
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setDuplicating(true)}>
                Duplicate fellowship
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle as="h2">Cohorts</CardTitle>
          {permissions.has('cohort.create') ? (
            <Button
              variant="secondary"
              onClick={() => navigate(`/admin/cohorts/new?fellowshipId=${fellowship.id}`)}
            >
              <Plus className="size-4" aria-hidden="true" />
              New cohort
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <DataTable
            columns={cohortColumns}
            rows={cohorts.rows}
            rowKey={(row) => row.id}
            isLoading={cohorts.isLoading}
            error={cohorts.error}
            emptyTitle="No cohorts yet"
            emptyDescription="Schedule a cohort to start enrolling learners into this fellowship."
            onRowClick={(row) => navigate(`/admin/cohorts/${row.id}`)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Chat</CardTitle>
          <p className="text-sm text-muted-foreground">
            The same Fellowship Chat your mentors and students use — see and send messages in any
            channel, moderate, and create new channels.
          </p>
        </CardHeader>
        <CardContent>
          <ChatWorkspace fellowshipId={fellowship.id} className="h-[600px]" />
        </CardContent>
      </Card>
    </div>
  );
}
