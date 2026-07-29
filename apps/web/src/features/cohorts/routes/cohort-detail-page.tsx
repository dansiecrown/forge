import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Input } from '@/components/ui/input';
import {
  useCohortLifecycleActions,
  useEnrollmentActions,
  useMentorAssignment,
  useUpdateCohort,
} from '../hooks/use-cohort-mutations';
import { useCohort, useCohortEnrollments, useCohortMentors } from '../hooks/use-cohorts';
import {
  membershipIdSchema,
  studentUserIdSchema,
  updateCohortSchema,
  type MembershipIdFormValues,
  type StudentUserIdFormValues,
  type UpdateCohortFormValues,
} from '../schemas/cohort-schemas';

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

  const form = useForm<UpdateCohortFormValues>({ resolver: zodResolver(updateCohortSchema) });
  const mentorForm = useForm<MembershipIdFormValues>({ resolver: zodResolver(membershipIdSchema) });
  const enrollForm = useForm<StudentUserIdFormValues>({
    resolver: zodResolver(studentUserIdSchema),
  });

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

  async function onAssignMentor(values: MembershipIdFormValues) {
    try {
      await assign.mutateAsync(values.membershipId);
      mentorForm.reset();
    } catch {
      // surfaced below via assign.error
    }
  }

  async function onEnroll(values: StudentUserIdFormValues) {
    try {
      await enroll.mutateAsync({ studentUserId: values.studentUserId });
      enrollForm.reset();
    } catch {
      // surfaced below via enroll.error
    }
  }

  const updateErrorMessage =
    updateCohort.error instanceof ApiError ? updateCohort.error.message : null;

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
        action={<Badge tone={STATUS_TONE[cohort.status]}>{cohort.status}</Badge>}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Schedule &amp; capacity</CardTitle>
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

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {cohort.status === 'draft' ? (
              <Button
                onClick={() =>
                  updateCohort.mutate({ body: { status: 'enrolling' }, version: cohort.version })
                }
                loading={updateCohort.isPending}
              >
                Open enrollment
              </Button>
            ) : null}
            {cohort.status === 'enrolling' || cohort.status === 'paused' ? (
              <Button loading={activate.isPending} onClick={() => activate.mutate(cohort.version)}>
                Activate
              </Button>
            ) : null}
            {cohort.status === 'active' ? (
              <Button
                variant="secondary"
                loading={pause.isPending}
                onClick={() => pause.mutate(cohort.version)}
              >
                Pause
              </Button>
            ) : null}
            {cohort.status === 'active' || cohort.status === 'paused' ? (
              <Button
                variant="secondary"
                loading={complete.isPending}
                onClick={() => complete.mutate(cohort.version)}
              >
                Mark complete
              </Button>
            ) : null}
            {cohort.status === 'completed' ? (
              <Button
                variant="destructive"
                loading={updateCohort.isPending}
                onClick={() =>
                  updateCohort.mutate({ body: { status: 'archived' }, version: cohort.version })
                }
              >
                Archive
              </Button>
            ) : null}
            {cohort.status === 'archived' ? (
              <p className="text-sm text-muted-foreground">This cohort is archived.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Curriculum</CardTitle>
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

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Assigned mentors</CardTitle>
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
                  onClick={() => unassign.mutate(mentor.membershipId)}
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
          <form
            className="mt-4 space-y-2"
            onSubmit={mentorForm.handleSubmit(onAssignMentor)}
            noValidate
          >
            <div className="flex gap-2">
              <Input
                aria-label="Mentor membership id"
                placeholder="Mentor membership id (uuid)"
                aria-invalid={Boolean(mentorForm.formState.errors.membershipId)}
                {...mentorForm.register('membershipId')}
              />
              <Button type="submit" variant="secondary" loading={assign.isPending}>
                Assign
              </Button>
            </div>
            {mentorForm.formState.errors.membershipId ? (
              <p className="text-sm text-danger">
                {mentorForm.formState.errors.membershipId.message}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Enrollments</CardTitle>
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
          <form className="mt-4 space-y-2" onSubmit={enrollForm.handleSubmit(onEnroll)} noValidate>
            <div className="flex gap-2">
              <Input
                aria-label="Student user id"
                placeholder="Student user id (uuid)"
                aria-invalid={Boolean(enrollForm.formState.errors.studentUserId)}
                {...enrollForm.register('studentUserId')}
              />
              <Button type="submit" variant="secondary" loading={enroll.isPending}>
                Enroll
              </Button>
            </div>
            {enrollForm.formState.errors.studentUserId ? (
              <p className="text-sm text-danger">
                {enrollForm.formState.errors.studentUserId.message}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
