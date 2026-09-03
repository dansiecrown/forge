import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiRequest, ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { useActiveOrganization } from '@/contexts/organization-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useAcademy } from '../hooks/use-academies';
import { useAcademyLifecycleActions, useUpdateAcademy } from '../hooks/use-academy-mutations';
import {
  actionReasonSchema,
  updateAcademySchema,
  type ActionReasonFormValues,
  type UpdateAcademyFormValues,
} from '../schemas/academy-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = { active: 'success', archived: 'danger' };

export function AcademyDetailPage() {
  const { academyId } = useParams<{ academyId: string }>();
  const { data: academy, isLoading, error } = useAcademy(academyId);
  const updateAcademy = useUpdateAcademy(academyId ?? '');
  const { archive, restore } = useAcademyLifecycleActions(academyId ?? '');
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const { activeOrganizationId } = useActiveOrganization();
  const permissions = usePermissions();
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
  const reasonForm = useForm<ActionReasonFormValues>({ resolver: zodResolver(actionReasonSchema) });

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

  async function onConfirmArchive(values: ActionReasonFormValues) {
    await archive.mutateAsync(values.reason);
    setConfirmingArchive(false);
    reasonForm.reset();
  }

  const updateErrorMessage =
    updateAcademy.error instanceof ApiError ? updateAcademy.error.message : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={academy.name}
        description={
          <>
            <Link to="/admin/academies" className="text-brand hover:underline">
              Academies
            </Link>{' '}
            / {academy.slug}
          </>
        }
        action={<Badge tone={STATUS_TONE[academy.status]}>{academy.status}</Badge>}
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
            <div className="flex items-center gap-2">
              <input
                id="isPublic"
                type="checkbox"
                className="size-4 rounded border-border"
                {...form.register('isPublic')}
              />
              <Label htmlFor="isPublic">Visible in the public catalogue</Label>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={updateAcademy.isPending}>
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
          {confirmingArchive ? (
            <form
              className="space-y-3"
              onSubmit={reasonForm.handleSubmit(onConfirmArchive)}
              noValidate
            >
              <FormField
                label="Reason to archive this academy"
                autoFocus
                error={reasonForm.formState.errors.reason?.message}
                {...reasonForm.register('reason')}
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingArchive(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" loading={archive.isPending}>
                  Confirm archive
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-3">
              {academy.status === 'active' && permissions.has('academy.archive') ? (
                <Button variant="destructive" onClick={() => setConfirmingArchive(true)}>
                  Archive
                </Button>
              ) : null}
              {academy.status === 'archived' && permissions.has('academy.restore') ? (
                <Button
                  variant="secondary"
                  loading={restore.isPending}
                  onClick={() => restore.mutate()}
                >
                  Restore
                </Button>
              ) : null}
              {!permissions.has('academy.archive') && !permissions.has('academy.restore') ? (
                <p className="text-sm text-muted-foreground">
                  Your role can view this academy but not change its lifecycle status.
                </p>
              ) : null}
            </div>
          )}
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
    </div>
  );
}
