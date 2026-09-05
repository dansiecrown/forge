import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Loader2,
  Pencil,
  Route,
  UserCheck,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { ActionsMenu, type ActionsMenuItem } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Breadcrumb } from '@/components/admin/breadcrumb';
import { DefinitionList } from '@/components/admin/definition-list';
import { PersonSearchField } from '@/components/admin/person-search-field';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { useToast } from '@/components/ui/toast';
import { usePermissions } from '@/hooks/use-permissions';
import type { AdminUser } from '@/features/admin-users/api/admin-users-api';
import { useOrganization } from '@/features/organizations';
import { useAcademy } from '@/features/academies';
import { useFellowship } from '@/features/fellowships';
import { useLearningTracksOptions } from '@/features/learning-tracks';
import {
  useCohortLifecycleActions,
  useEnrollmentActions,
  useMentorAssignment,
  useSetCohortTracks,
  useUpdateCohort,
} from '../hooks/use-cohort-mutations';
import {
  useCohort,
  useCohortEnrollments,
  useCohortMentors,
  useCohortOfferedTracks,
} from '../hooks/use-cohorts';
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
  const organization = useOrganization(cohort?.organizationId, cohort?.organizationId);
  const academy = useAcademy(cohort?.academyId);
  const fellowship = useFellowship(cohort?.fellowshipId);
  const updateCohort = useUpdateCohort(cohortId ?? '');
  const { activate, pause, complete, syncCurriculum, closeTrackSwitching, reopenTrackSwitching } =
    useCohortLifecycleActions(cohortId ?? '');
  const mentors = useCohortMentors(cohortId);
  const { assign, unassign } = useMentorAssignment(cohortId ?? '');
  const enrollments = useCohortEnrollments(cohortId);
  const { enroll, updateStatus } = useEnrollmentActions(cohortId ?? '');
  const offeredTracks = useCohortOfferedTracks(cohortId);
  const fellowshipTracks = useLearningTracksOptions(cohort?.fellowshipId);
  const setTracks = useSetCohortTracks(cohortId ?? '');
  const [tracksEditOpen, setTracksEditOpen] = useState(false);
  const [trackSelection, setTrackSelection] = useState<string[]>([]);
  const [mentorPick, setMentorPick] = useState<AdminUser | null>(null);
  const [studentPick, setStudentPick] = useState<AdminUser | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingTrackSwitchAction, setConfirmingTrackSwitchAction] = useState<
    'close' | 'reopen' | null
  >(null);
  const [unassigningMembershipId, setUnassigningMembershipId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const toast = useToast();
  const permissions = usePermissions();

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
      toast.success('Cohort schedule updated.');
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update cohort.');
    }
  }

  function openTracksEdit() {
    setTrackSelection((offeredTracks.data ?? []).map((t) => t.id));
    setTracksEditOpen(true);
  }

  async function onSaveTracks() {
    try {
      await setTracks.mutateAsync({ learningTrackIds: trackSelection });
      toast.success('Cohort tracks updated.');
      setTracksEditOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update cohort tracks.');
    }
  }

  async function onAssignMentor() {
    if (!mentorPick) return;
    try {
      await assign.mutateAsync(mentorPick);
      toast.success(`${mentorPick.displayName} assigned as mentor.`);
      setMentorPick(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to assign mentor.');
    }
  }

  async function onEnroll() {
    if (!studentPick) return;
    try {
      await enroll.mutateAsync(studentPick);
      toast.success(`${studentPick.displayName} enrolled.`);
      setStudentPick(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to enroll student.');
    }
  }

  async function onConfirmArchive() {
    if (!cohort) return;
    try {
      await updateCohort.mutateAsync({ body: { status: 'archived' }, version: cohort.version });
      toast.success('Cohort archived.');
      setConfirmingArchive(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to archive cohort.');
    }
  }

  async function onConfirmTrackSwitchAction() {
    if (!confirmingTrackSwitchAction || !cohort) return;
    try {
      if (confirmingTrackSwitchAction === 'close') {
        await closeTrackSwitching.mutateAsync(cohort.version);
        toast.success('Track switching closed for this cohort.');
      } else {
        await reopenTrackSwitching.mutateAsync(cohort.version);
        toast.success('Track switching reopened for this cohort.');
      }
      setConfirmingTrackSwitchAction(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update track switching.');
    }
  }

  async function onConfirmUnassign() {
    if (!unassigningMembershipId) return;
    try {
      await unassign.mutateAsync(unassigningMembershipId);
      toast.success('Mentor unassigned.');
      setUnassigningMembershipId(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to unassign mentor.');
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
              ...(fellowship.data
                ? [{ label: fellowship.data.title, to: `/admin/fellowships/${fellowship.data.id}` }]
                : []),
              { label: cohort.name },
            ]}
          />
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle as="h2" className="flex items-center gap-2">
              <Calendar className="size-5 text-muted-foreground" aria-hidden="true" />
              Schedule &amp; capacity
            </CardTitle>
            {permissions.has('cohort.update') ? (
              <Button
                variant="secondary"
                onClick={() => setEditOpen(true)}
                aria-label="Edit schedule and capacity"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                { label: 'Name', value: cohort.name },
                { label: 'Starts at', value: new Date(cohort.startsAt).toLocaleString() },
                { label: 'Ends at', value: new Date(cohort.endsAt).toLocaleString() },
                { label: 'Timezone', value: cohort.timezone },
                { label: 'Capacity', value: cohort.capacity },
                { label: 'Description', value: cohort.description },
              ]}
            />
          </CardContent>
        </Card>

        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title="Edit schedule and capacity"
        >
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
            <FormField
              label="Description"
              error={form.formState.errors.description?.message}
              {...form.register('description')}
            />
            <div className="flex w-full justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={updateCohort.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </Dialog>

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

        <Card className="lg:col-span-1" revealDelayMs={90}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle as="h2" className="flex items-center gap-2">
              <Route className="size-5 text-muted-foreground" aria-hidden="true" />
              Learning Tracks
            </CardTitle>
            {permissions.has('cohort.update') ? (
              <Button variant="secondary" onClick={openTracksEdit} aria-label="Edit offered tracks">
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {offeredTracks.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : offeredTracks.data && offeredTracks.data.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {offeredTracks.data.map((track) => (
                  <Badge key={track.id} tone="brand">
                    {track.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No explicit selection — every track under this Fellowship is currently offered.
              </p>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Track switching:{' '}
                  <Badge tone={cohort.trackSwitchClosedAt ? 'warning' : 'success'}>
                    {cohort.trackSwitchClosedAt ? 'Closed' : 'Open'}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {cohort.trackSwitchClosedAt
                    ? `Learners can no longer change their track. Closed ${new Date(cohort.trackSwitchClosedAt).toLocaleString()}.`
                    : "Learners may still switch their own track. A learner's first pick is never affected by this setting."}
                </p>
              </div>
              {permissions.has('cohort.update') ? (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setConfirmingTrackSwitchAction(cohort.trackSwitchClosedAt ? 'reopen' : 'close')
                  }
                >
                  {cohort.trackSwitchClosedAt ? 'Reopen' : 'Close'}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={tracksEditOpen}
          onClose={() => setTracksEditOpen(false)}
          title="Edit offered Learning Tracks"
          description="Students enrolling in this cohort can only choose from the tracks selected here. Select none to offer every track under the Fellowship."
        >
          {setTracks.error instanceof ApiError ? (
            <Alert variant="danger" className="mb-3">
              {setTracks.error.message}
            </Alert>
          ) : null}
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(fellowshipTracks.data?.items ?? []).map((track) => (
              <label
                key={track.id}
                className="flex items-center gap-2.5 rounded-control border border-border bg-surface-2 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={trackSelection.includes(track.id)}
                  onChange={(e) =>
                    setTrackSelection((prev) =>
                      e.target.checked ? [...prev, track.id] : prev.filter((id) => id !== track.id),
                    )
                  }
                />
                {track.name}
              </label>
            ))}
            {fellowshipTracks.data?.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This Fellowship has no Learning Tracks yet.
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setTracksEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" loading={setTracks.isPending} onClick={() => void onSaveTracks()}>
              Save
            </Button>
          </div>
        </Dialog>

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
                  <div className="min-w-0 truncate">
                    <span className="font-medium text-foreground">{mentor.userDisplayName}</span>{' '}
                    <span className="text-xs text-muted-foreground">{mentor.userEmail}</span>
                  </div>
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
                  <div className="min-w-0 truncate text-sm">
                    <span className="font-medium text-foreground">
                      {enrollment.userDisplayName ?? enrollment.userId}
                    </span>
                    {enrollment.userEmail ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {enrollment.userEmail}
                      </span>
                    ) : null}
                  </div>
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
        open={confirmingTrackSwitchAction !== null}
        onClose={() => setConfirmingTrackSwitchAction(null)}
        onConfirm={onConfirmTrackSwitchAction}
        loading={closeTrackSwitching.isPending || reopenTrackSwitching.isPending}
        error={
          closeTrackSwitching.error instanceof ApiError
            ? closeTrackSwitching.error.message
            : reopenTrackSwitching.error instanceof ApiError
              ? reopenTrackSwitching.error.message
              : null
        }
        title={
          confirmingTrackSwitchAction === 'close'
            ? 'Close track switching for this cohort?'
            : 'Reopen track switching for this cohort?'
        }
        description={
          confirmingTrackSwitchAction === 'close'
            ? "Enrolled learners will no longer be able to change their own track. A learner who hasn't picked a track yet is unaffected."
            : 'Enrolled learners will be able to switch their own track again.'
        }
        confirmLabel={
          confirmingTrackSwitchAction === 'close' ? 'Close switching' : 'Reopen switching'
        }
        confirmVariant={confirmingTrackSwitchAction === 'close' ? 'destructive' : 'primary'}
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
