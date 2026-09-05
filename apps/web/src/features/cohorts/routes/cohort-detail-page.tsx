import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Calendar, ClipboardList, Loader2, UserCheck, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { ActionsMenu, type ActionsMenuItem } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { PersonSearchField } from '@/components/admin/person-search-field';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import type { AdminUser } from '@/features/admin-users/api/admin-users-api';
import {
  useCohortLifecycleActions,
  useEnrollmentActions,
  useMentorAssignment,
  useUpdateCohort,
} from '../hooks/use-cohort-mutations';
import { useCohort, useCohortEnrollments, useCohortMentors } from '../hooks/use-cohorts';
import { updateCohortSchema, type UpdateCohortFormValues } from '../schemas/cohort-schemas';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  enrolling: 'brand',
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
  archived: 'danger',
};

const ENROLLMENT_STATUS_TONE: Record<string, BadgeProps['tone']> = {
  invited: 'neutral',
  active: 'success',
  paused: 'warning',
  completed: 'brand',
  withdrawn: 'danger',
};

/** Local ISO <-> `datetime-local` input conversion (no timezone library in
 * the stack — the value is treated as the browser's local time, matching
 * the plain HTML date/time input contract). */
function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { data: cohort, isLoading, error } = useCohort(cohortId);
  const updateCohort = useUpdateCohort(cohortId ?? '');
  const { activate, pause, complete, syncCurriculum } = useCohortLifecycleActions(cohortId ?? '');
  const mentors = useCohortMentors(cohortId);
  const { assign, unassign } = useMentorAssignment(cohortId ?? '');
  const enrollments = useCohortEnrollments(cohortId);
  const { enroll, updateStatus } = useEnrollmentActions(cohortId ?? '');
  const [mentorPick, setMentorPick] = useState<AdminUser | null>(null);
  const [studentPick, setStudentPick] = useState<AdminUser | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [unassigningMembershipId, setUnassigningMembershipId] = useState<string | null>(null);

  const form = useForm<UpdateCohortFormValues>({ resolver: zodResolver(updateCohortSchema) });

  useEffect(() => {
    if (cohort) {
      form.reset({
        name: cohort.name,
        startsAt: toLocalInputValue(cohort.startsAt),
        endsAt: toLocalInputValue(cohort.endsAt),
        timezone: cohort.timezone,
        capacity: cohort.capacity,
        description: cohort.description ?? '',
      });
    }
  }, [cohort, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Cohort not found.'}
      </Alert>
    );
  }

  async function onSubmit(values: UpdateCohortFormValues) {
    if (!cohort) return;
    try {
      await updateCohort.mutateAsync({
        body: {
          name: values.name,
          startsAt: new Date(values.startsAt).toISOString(),
          endsAt: new Date(values.endsAt).toISOString(),
          timezone: values.timezone,
          capacity: values.capacity,
          description: values.description || undefined,
        },
        version: cohort.version,
      });
    } catch {
      // surfaced below via updateCohort.error
    }
  }

  async function onAssignMentor() {
    if (!mentorPick) return;
    try {
      await assign.mutateAsync(mentorPick);
      setMentorPick(null);
    } catch {
      // surfaced below via assign.error
    }
  }

  async function onEnroll() {
    if (!studentPick) return;
    try {
      await enroll.mutateAsync(studentPick);
      setStudentPick(null);
    } catch {
      // surfaced below via enroll.error
    }
  }

  async function onConfirmArchive() {
    if (!cohort) return;
    try {
      await updateCohort.mutateAsync({ body: { status: 'archived' }, version: cohort.version });
      setConfirmingArchive(false);
    } catch {
      // surfaced below via updateCohort.error
    }
  }

  async function onConfirmUnassign() {
    if (!unassigningMembershipId) return;
    try {
      await unassign.mutateAsync(unassigningMembershipId);
      setUnassigningMembershipId(null);
    } catch {
      // surfaced below via unassign.error
    }
  }

  const updateErrorMessage =
    updateCohort.error instanceof ApiError ? updateCohort.error.message : null;

  // Compact popup replacement for the old always-visible "Lifecycle" card —
  // only the transitions valid for the current status appear.
  const lifecycleItems: ActionsMenuItem[] = [];
  if (cohort.status === 'draft') {
    lifecycleItems.push({
      label: 'Open enrollment',
      loading: updateCohort.isPending,
      onSelect: () =>
        updateCohort.mutate({ body: { status: 'enrolling' }, version: cohort.version }),
    });
  }
  if (cohort.status === 'enrolling' || cohort.status === 'paused') {
    lifecycleItems.push({
      label: 'Activate',
      loading: activate.isPending,
      onSelect: () => activate.mutate(cohort.version),
    });
  }
  if (cohort.status === 'active') {
    lifecycleItems.push({
      label: 'Pause',
      loading: pause.isPending,
      onSelect: () => pause.mutate(cohort.version),
    });
  }
  if (cohort.status === 'active' || cohort.status === 'paused') {
    lifecycleItems.push({
      label: 'Mark complete',
      loading: complete.isPending,
      onSelect: () => complete.mutate(cohort.version),
    });
  }
  if (cohort.status === 'completed') {
    lifecycleItems.push({
      label: 'Archive',
      tone: 'danger',
      onSelect: () => setConfirmingArchive(true),
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={cohort.name}
        description={
          <>
            <Link to="/admin/cohorts" className="text-brand hover:underline">
              Cohorts
            </Link>{' '}
            / {cohort.slug}
          </>
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[cohort.status]}>{cohort.status}</Badge>
            <ActionsMenu items={lifecycleItems} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Calendar className="size-5 text-muted-foreground" aria-hidden="true" />
              Schedule &amp; capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              {updateErrorMessage ? <Alert variant="danger">{updateErrorMessage}</Alert> : null}
              <FormField
                label="Name"
                error={form.formState.errors.name?.message}
                {...form.register('name')}
              />
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Timezone"
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
              </div>
              <FormField
                label="Description"
                error={form.formState.errors.description?.message}
                {...form.register('description')}
              />
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={updateCohort.isPending}>
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" revealDelayMs={60}>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
              Curriculum
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {cohort.curriculumSnapshotAt
                ? `Last synced ${new Date(cohort.curriculumSnapshotAt).toLocaleString()}. Editing curriculum since then has not changed what this cohort's learners see.`
                : 'No curriculum snapshot yet.'}
            </p>
            <Button
              variant="secondary"
              loading={syncCurriculum.isPending}
              onClick={() => syncCurriculum.mutate(cohort.version)}
            >
              Sync curriculum now
            </Button>
            {syncCurriculum.error instanceof ApiError ? (
              <Alert variant="danger">{syncCurriculum.error.message}</Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" revealDelayMs={120}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle as="h2" className="flex items-center gap-2">
              <UserCheck className="size-5 text-muted-foreground" aria-hidden="true" />
              Assigned mentors
            </CardTitle>
            <Badge tone="neutral">{mentors.data?.length ?? 0}</Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(mentors.data ?? []).map((mentor) => (
                <li
                  key={mentor.id}
                  className="flex items-center justify-between rounded-control border border-border bg-surface-2 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {mentor.membershipId}
                  </span>
                  <button
                    type="button"
                    aria-label="Unassign mentor"
                    onClick={() => setUnassigningMembershipId(mentor.membershipId)}
                    className="text-muted-foreground transition-colors hover:text-danger"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {mentors.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mentors assigned yet.</p>
              ) : null}
            </ul>
            {assign.error instanceof ApiError ? (
              <Alert variant="danger" className="mb-3">
                {assign.error.message}
              </Alert>
            ) : null}
            <form
              className="mt-4 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void onAssignMentor();
              }}
              noValidate
            >
              <div className="flex gap-2">
                <div className="flex-1">
                  <PersonSearchField
                    label="Mentor"
                    placeholder="Search mentor by name or email…"
                    selected={mentorPick}
                    onSelect={setMentorPick}
                    onClear={() => setMentorPick(null)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  loading={assign.isPending}
                  disabled={!mentorPick}
                >
                  Assign
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" revealDelayMs={180}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle as="h2" className="flex items-center gap-2">
              <ClipboardList className="size-5 text-muted-foreground" aria-hidden="true" />
              Enrollments
            </CardTitle>
            <Badge tone="neutral">{enrollments.rows.length}</Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {enrollments.rows.map((enrollment) => (
                <li
                  key={enrollment.id}
                  className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-3 py-2 text-sm"
                >
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {enrollment.userId}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone={ENROLLMENT_STATUS_TONE[enrollment.status]}>
                      {enrollment.status}
                    </Badge>
                    {enrollment.status === 'invited' ? (
                      <Button
                        variant="secondary"
                        loading={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({
                            id: enrollment.id,
                            body: { status: 'active' },
                            version: enrollment.version,
                          })
                        }
                      >
                        Activate
                      </Button>
                    ) : null}
                    {enrollment.status === 'active' || enrollment.status === 'paused' ? (
                      <Button
                        variant="secondary"
                        loading={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({
                            id: enrollment.id,
                            body: { status: 'withdrawn' },
                            version: enrollment.version,
                          })
                        }
                      >
                        Withdraw
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
              {enrollments.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one is enrolled in this cohort yet.
                </p>
              ) : null}
            </ul>
            {enroll.error instanceof ApiError ? (
              <Alert variant="danger" className="mt-3">
                {enroll.error.message}
              </Alert>
            ) : null}
            <form
              className="mt-4 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void onEnroll();
              }}
              noValidate
            >
              <div className="flex gap-2">
                <div className="flex-1">
                  <PersonSearchField
                    label="Student"
                    placeholder="Search student by name or email…"
                    selected={studentPick}
                    onSelect={setStudentPick}
                    onClear={() => setStudentPick(null)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  loading={enroll.isPending}
                  disabled={!studentPick}
                >
                  Enroll
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmingArchive}
        onClose={() => setConfirmingArchive(false)}
        onConfirm={onConfirmArchive}
        loading={updateCohort.isPending}
        error={updateCohort.error instanceof ApiError ? updateCohort.error.message : null}
        title="Archive this cohort?"
        description="It moves out of active operation and can no longer be edited."
        confirmLabel="Archive"
      />

      <ConfirmDialog
        open={unassigningMembershipId !== null}
        onClose={() => setUnassigningMembershipId(null)}
        onConfirm={onConfirmUnassign}
        loading={unassign.isPending}
        error={unassign.error instanceof ApiError ? unassign.error.message : null}
        title="Unassign this mentor?"
        description="They lose access to this cohort's Mentor Portal workspace immediately."
        confirmLabel="Unassign"
      />
    </div>
  );
}
