import { useState } from 'react';
import { BookOpen, CheckCircle2, ClipboardCheck, FileText, Loader2, Route } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/portal/empty-state';
import { ProgressRing } from '@/components/portal/progress-ring';
import { Timeline } from '@/components/portal/timeline';
import type { StudentActivityItem } from '@forge/api-contract';
import { ApiError } from '@/api/client';
import { useMyEnrollment } from '@/contexts/enrollment-context';
import { useCohort, useCohortOfferedTracks } from '@/features/cohorts/hooks/use-cohorts';
import { useSelectEnrollmentTrack } from '@/features/cohorts/hooks/use-cohort-mutations';
import { useLearningTracksOptions } from '@/features/learning-tracks';
import {
  useActivity,
  useDashboard,
  useMyAttendance,
  useWeeklyModules,
} from '@/features/student-curriculum/hooks/use-student-curriculum';

const ATTENDANCE_TONE: Record<string, BadgeProps['tone']> = {
  present: 'success',
  absent: 'danger',
  excused: 'warning',
};

const LOCK_STATE_TONE: Record<string, BadgeProps['tone']> = {
  completed: 'success',
  current: 'brand',
  locked: 'neutral',
};

const ACTIVITY_ICON: Record<StudentActivityItem['type'], typeof BookOpen> = {
  lesson: BookOpen,
  resource: FileText,
  task: ClipboardCheck,
};

/** Self-service pick/switch — see docs/adr/0017-track-switch-grace-period.md.
 * Shared between the first-pick empty state and the later "Switch track"
 * action; the server enforces the actual grace-period rule regardless of
 * what this dialog shows, but showing the cohort's own state here avoids
 * sending a learner into a switch that's certain to be rejected. */
function TrackPickerDialog({
  open,
  onClose,
  mode,
  currentTrackId,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'select' | 'switch';
  currentTrackId: string | null;
}) {
  const { enrollment } = useMyEnrollment();
  const cohort = useCohort(enrollment?.cohortId);
  const offeredTracks = useCohortOfferedTracks(enrollment?.cohortId);
  const fellowshipTracks = useLearningTracksOptions(enrollment?.fellowshipId);
  const selectTrack = useSelectEnrollmentTrack(enrollment?.id ?? '');
  const toast = useToast();
  const [pickedTrackId, setPickedTrackId] = useState<string | null>(null);

  const availableTracks = (
    offeredTracks.data && offeredTracks.data.length > 0
      ? offeredTracks.data
      : (fellowshipTracks.data?.items ?? [])
  ).filter((track) => track.status === 'published');

  const switchingClosed = mode === 'switch' && Boolean(cohort.data?.trackSwitchClosedAt);
  const isLoading = offeredTracks.isLoading || fellowshipTracks.isLoading;

  async function onConfirm() {
    if (!pickedTrackId) return;
    try {
      await selectTrack.mutateAsync({ learningTrackId: pickedTrackId });
      toast.success(mode === 'switch' ? 'Learning track switched.' : 'Learning track selected.');
      setPickedTrackId(null);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update your learning track.');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'switch' ? 'Switch your learning track' : 'Choose your learning track'}
      description={
        mode === 'select'
          ? "This is a one-time pick — you'll be able to switch later unless an admin closes switching for your cohort."
          : undefined
      }
    >
      {switchingClosed ? (
        <Alert variant="danger" className="mb-4">
          Track switching is closed for your cohort. Contact an admin if you need to change tracks.
        </Alert>
      ) : null}
      {selectTrack.error instanceof ApiError ? (
        <Alert variant="danger" className="mb-4">
          {selectTrack.error.message}
        </Alert>
      ) : null}
      {isLoading ? (
        <div className="flex min-h-24 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : availableTracks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No learning tracks are available yet.</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {availableTracks.map((track) => (
            <label
              key={track.id}
              className="flex items-center gap-2.5 rounded-control border border-border bg-surface-2 px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="learning-track"
                className="size-4 border-border"
                checked={pickedTrackId === track.id}
                disabled={switchingClosed}
                onChange={() => setPickedTrackId(track.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{track.name}</span>
                {track.description ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {track.description}
                  </span>
                ) : null}
              </span>
              {track.id === currentTrackId ? <Badge tone="neutral">Current</Badge> : null}
            </label>
          ))}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          loading={selectTrack.isPending}
          disabled={!pickedTrackId || pickedTrackId === currentTrackId || switchingClosed}
          onClick={() => void onConfirm()}
        >
          {mode === 'switch' ? 'Switch track' : 'Confirm selection'}
        </Button>
      </div>
    </Dialog>
  );
}

export function ProgressCenterPage() {
  const { data: dashboard, isLoading: dashboardLoading } = useDashboard();
  const { data: modules, isLoading: modulesLoading } = useWeeklyModules();
  const { data: activity, isLoading: activityLoading } = useActivity(30);
  const { data: attendance, isLoading: attendanceLoading } = useMyAttendance();
  const { enrollment } = useMyEnrollment();
  const [pickerOpen, setPickerOpen] = useState(false);

  const isLoading = dashboardLoading || modulesLoading || activityLoading || attendanceLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (!dashboard?.hasActiveTrack) {
    return (
      <div>
        <AdminPageHeader title="Progress" />
        <EmptyState
          title="No active learning track yet"
          description="Choose a learning track to start your curriculum."
          action={<Button onClick={() => setPickerOpen(true)}>Choose your learning track</Button>}
        />
        <TrackPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          mode="select"
          currentTrackId={null}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Progress"
        description="Your learning journey, week by week."
        action={
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            <Route className="size-4" aria-hidden="true" />
            Switch track
          </Button>
        }
      />
      <TrackPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode="switch"
        currentTrackId={enrollment?.currentLearningTrackId ?? null}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col items-center gap-2 py-6 text-center">
          <ProgressRing percent={dashboard.progressPercent} size={88} />
          <p className="text-sm text-muted-foreground">Overall completion</p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="text-2xl font-semibold text-foreground">{dashboard.streakDays}</p>
          <p className="text-sm text-muted-foreground">day streak</p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="text-2xl font-semibold text-foreground">
            {modules?.filter((m) => m.lockState === 'completed').length ?? 0}
          </p>
          <p className="text-sm text-muted-foreground">weeks completed</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Weekly progress</CardTitle>
        </CardHeader>
        <CardContent>
          {!modules || modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules yet.</p>
          ) : (
            <ul className="space-y-3">
              {modules.map((module) => (
                <li key={module.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {module.lockState === 'completed' ? (
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <div
                        className="size-4 rounded-full border border-border"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-sm text-foreground">
                      Week {module.weekNumber}: {module.title}
                    </span>
                  </div>
                  <Badge tone={LOCK_STATE_TONE[module.lockState]}>{module.lockState}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Weekly huddle attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {!attendance || attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No huddle attendance recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {attendance.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">Week {entry.weekNumber}</span>
                  <Badge tone={ATTENDANCE_TONE[entry.status]}>{entry.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Activity timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {!activity || activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <Timeline
              items={activity.map((item) => {
                const Icon = ACTIVITY_ICON[item.type];
                return {
                  id: `${item.type}-${item.id}`,
                  icon: <Icon className="size-4" aria-hidden="true" />,
                  title: item.title,
                  meta: new Date(item.occurredAt).toLocaleString(),
                };
              })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
