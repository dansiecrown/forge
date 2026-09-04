import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AttendanceStatusToggle } from '@/components/mentor/attendance-status-toggle';
import { EmptyState } from '@/components/portal/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Select } from '@/components/ui/select';
import { TextareaField } from '@/components/textarea-field';
import { useMentorContext } from '@/contexts/mentor-context';
import { useCohortStudents } from '@/features/mentor-workspace/hooks/use-mentor-workspace';
import {
  useHuddleSession,
  useRecordAttendance,
  useSessionAttendance,
  useUpsertHuddleSession,
} from '../hooks/use-mentor-huddles';

const WEEK_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);

const huddleSchema = z.object({
  notes: z.string().max(4000).optional().or(z.literal('')),
  discussionTopics: z.string().max(1000).optional().or(z.literal('')),
  actionItems: z.string().max(1000).optional().or(z.literal('')),
});
type HuddleFormValues = z.infer<typeof huddleSchema>;

function splitList(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

export function MentorHuddlesPage() {
  const {
    cohorts,
    selectedCohortId,
    setSelectedCohortId,
    isLoading: cohortsLoading,
  } = useMentorContext();
  const [weekNumber, setWeekNumber] = useState(1);

  const { data: session, isLoading: sessionLoading } = useHuddleSession(
    selectedCohortId,
    weekNumber,
  );
  const upsertSession = useUpsertHuddleSession(selectedCohortId ?? '', weekNumber);

  const form = useForm<HuddleFormValues>({
    resolver: zodResolver(huddleSchema),
    defaultValues: { notes: '', discussionTopics: '', actionItems: '' },
  });

  useEffect(() => {
    form.reset({
      notes: session?.notes ?? '',
      discussionTopics: (session?.discussionTopics ?? []).join(', '),
      actionItems: (session?.actionItems ?? []).join(', '),
    });
  }, [session, form]);

  const errorMessage = upsertSession.error instanceof ApiError ? upsertSession.error.message : null;

  if (cohortsLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (cohorts.length === 0) {
    return (
      <EmptyState
        title="No cohorts assigned yet"
        description="Once an admin assigns you as a mentor to a cohort, you'll be able to record weekly huddles here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Weekly Huddles"
        description="Record what happened after the fact — no scheduling, no calendar."
      />

      <div className="flex flex-wrap gap-3">
        <Select
          value={selectedCohortId ?? ''}
          onChange={(event) => setSelectedCohortId(event.target.value)}
          aria-label="Cohort"
          className="w-auto min-w-[200px]"
        >
          {cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </Select>
        <Select
          value={weekNumber}
          onChange={(event) => setWeekNumber(Number(event.target.value))}
          aria-label="Week"
          className="w-auto min-w-[140px]"
        >
          {WEEK_OPTIONS.map((week) => (
            <option key={week} value={week}>
              Week {week}
            </option>
          ))}
        </Select>
      </div>

      {sessionLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Huddle notes</CardTitle>
            </CardHeader>
            <CardContent>
              {errorMessage ? (
                <Alert variant="danger" className="mb-4">
                  {errorMessage}
                </Alert>
              ) : null}
              <form
                className="flex flex-wrap gap-4"
                onSubmit={form.handleSubmit(async (values) => {
                  await upsertSession.mutateAsync({
                    notes: values.notes || undefined,
                    discussionTopics: splitList(values.discussionTopics),
                    actionItems: splitList(values.actionItems),
                  });
                })}
                noValidate
              >
                <FormField
                  label="Discussion topics (comma-separated)"
                  error={form.formState.errors.discussionTopics?.message}
                  {...form.register('discussionTopics')}
                />
                <FormField
                  label="Action items (comma-separated)"
                  error={form.formState.errors.actionItems?.message}
                  {...form.register('actionItems')}
                />
                <TextareaField
                  label="Notes"
                  rows={4}
                  error={form.formState.errors.notes?.message}
                  {...form.register('notes')}
                />
                <div className="flex w-full justify-end">
                  <Button type="submit" loading={upsertSession.isPending}>
                    Save huddle
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {session ? (
            <AttendanceRoster cohortId={selectedCohortId as string} sessionId={session.id} />
          ) : (
            <Card>
              <CardContent className="py-5 text-sm text-muted-foreground">
                Save the huddle above before recording attendance for week {weekNumber}.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function AttendanceRoster({ cohortId, sessionId }: { cohortId: string; sessionId: string }) {
  const { data: students, isLoading: studentsLoading } = useCohortStudents(cohortId, {});
  const { data: attendance, isLoading: attendanceLoading } = useSessionAttendance(sessionId);
  const recordAttendanceMutation = useRecordAttendance(sessionId);

  const [statuses, setStatuses] = useState<Record<string, 'present' | 'absent' | 'excused'>>({});

  useEffect(() => {
    if (attendance) {
      setStatuses(
        Object.fromEntries(attendance.map((entry) => [entry.enrollmentId, entry.status])),
      );
    }
  }, [attendance]);

  if (studentsLoading || attendanceLoading) {
    return (
      <div className="flex min-h-24 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (!students || students.length === 0) {
    return <EmptyState title="No students in this cohort yet" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Attendance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {students.map((student) => {
          const status = statuses[student.enrollmentId] ?? 'present';
          return (
            <div
              key={student.enrollmentId}
              className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <p className="text-sm font-medium text-foreground">{student.displayName}</p>
              <AttendanceStatusToggle
                value={status}
                onChange={(next) => {
                  setStatuses((prev) => ({ ...prev, [student.enrollmentId]: next }));
                  recordAttendanceMutation.mutate({
                    entries: [{ enrollmentId: student.enrollmentId, status: next }],
                  });
                }}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
