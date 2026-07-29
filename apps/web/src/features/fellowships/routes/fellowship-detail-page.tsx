import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
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

export function FellowshipDetailPage() {
  const { fellowshipId } = useParams<{ fellowshipId: string }>();
  const navigate = useNavigate();
  const { data: fellowship, isLoading, error } = useFellowship(fellowshipId);
  const updateFellowship = useUpdateFellowship(fellowshipId ?? '');
  const { publish, retire } = useFellowshipLifecycleActions(fellowshipId ?? '');
  const [confirmingRetire, setConfirmingRetire] = useState(false);

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
    } catch {
      // surfaced below via updateFellowship.error
    }
  }

  const updateErrorMessage =
    updateFellowship.error instanceof ApiError ? updateFellowship.error.message : null;
  const isDraft = fellowship.status === 'draft';

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={fellowship.title}
        description={
          <>
            <Link to="/admin/fellowships" className="text-brand hover:underline">
              Fellowships
            </Link>{' '}
            / {fellowship.slug}
          </>
        }
        action={<Badge tone={STATUS_TONE[fellowship.status]}>{fellowship.status}</Badge>}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Programme details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {updateErrorMessage ? <Alert variant="danger">{updateErrorMessage}</Alert> : null}
            <FormField
              label="Title"
              disabled={!isDraft}
              error={form.formState.errors.title?.message}
              {...form.register('title')}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Duration (weeks)"
                type="number"
                min={1}
                max={52}
                disabled={!isDraft}
                error={form.formState.errors.durationWeeks?.message}
                {...form.register('durationWeeks')}
              />
              <FormField
                label="Default capacity"
                type="number"
                min={1}
                disabled={!isDraft}
                error={form.formState.errors.defaultCapacity?.message}
                {...form.register('defaultCapacity')}
              />
            </div>
            <FormField
              label="Summary"
              disabled={!isDraft}
              error={form.formState.errors.summary?.message}
              {...form.register('summary')}
            />
            <FormField
              label="Description"
              disabled={!isDraft}
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="flex items-center gap-2">
              <input
                id="isPublic"
                type="checkbox"
                disabled={!isDraft}
                className="size-4 rounded border-border"
                {...form.register('isPublic')}
              />
              <Label htmlFor="isPublic">Visible in the public catalogue</Label>
            </div>
            {isDraft ? (
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={updateFellowship.isPending}>
                  Save changes
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Only draft fellowships can be edited.</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          {fellowship.status === 'draft' ? (
            <Button loading={publish.isPending} onClick={() => publish.mutate(fellowship.version)}>
              Publish
            </Button>
          ) : null}
          {fellowship.status === 'published' &&
            (confirmingRetire ? (
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingRetire(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  loading={retire.isPending}
                  onClick={() => {
                    retire.mutate(fellowship.version);
                    setConfirmingRetire(false);
                  }}
                >
                  Confirm retire
                </Button>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmingRetire(true)}>
                Retire
              </Button>
            ))}
          {fellowship.status === 'retired' ? (
            <p className="text-sm text-muted-foreground">This fellowship is retired.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
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
    </div>
  );
}
