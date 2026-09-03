import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { AtRiskBadge } from '@/components/mentor/at-risk-badge';
import { AvatarPlaceholder } from '@/components/mentor/avatar-placeholder';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Tabs } from '@/components/ui/tabs';
import { TextareaField } from '@/components/textarea-field';
import { EmptyState } from '@/components/portal/empty-state';
import { ProgressRing } from '@/components/portal/progress-ring';
import { ApiError } from '@/api/client';
import { useStudentWorkspace } from '../hooks/use-mentor-workspace';
import {
  useCreateMentorNote,
  useDeleteMentorNote,
  useUpdateMentorNote,
} from '../hooks/use-mentor-notes';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'submissions', label: 'Submissions' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'notes', label: 'Notes' },
  { value: 'attendance', label: 'Attendance' },
];

const SUBMISSION_STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  submitted: 'success',
  under_review: 'brand',
  revision_requested: 'warning',
  completed: 'success',
};

const ATTENDANCE_STATUS_TONE: Record<string, BadgeProps['tone']> = {
  present: 'success',
  absent: 'danger',
  excused: 'warning',
};

export function StudentWorkspacePage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const { data: workspace, isLoading, error } = useStudentWorkspace(enrollmentId);
  const [tab, setTab] = useState('overview');

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !workspace) {
    return <EmptyState title="We couldn't load this student's workspace." />;
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <AvatarPlaceholder name={workspace.displayName} size={48} />
          <div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
              {workspace.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">{workspace.email}</p>
          </div>
        </div>
        <AtRiskBadge atRisk={workspace.atRisk} reason={workspace.atRiskReason} />
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} className="mb-2" />

      <div role="tabpanel">
        {tab === 'overview' ? <OverviewTab workspace={workspace} /> : null}
        {tab === 'submissions' ? <SubmissionsTab workspace={workspace} /> : null}
        {tab === 'portfolio' ? <PortfolioTab workspace={workspace} /> : null}
        {tab === 'notes' ? (
          <NotesTab enrollmentId={enrollmentId as string} notes={workspace.notes} />
        ) : null}
        {tab === 'attendance' ? <AttendanceTab workspace={workspace} /> : null}
      </div>
    </div>
  );
}

type Workspace = NonNullable<ReturnType<typeof useStudentWorkspace>['data']>;

function OverviewTab({ workspace }: { workspace: Workspace }) {
  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr]">
      <Card className="flex flex-col items-center justify-center gap-3 py-6 text-center">
        <ProgressRing percent={workspace.progressPercent} size={112} />
        <p className="text-sm text-muted-foreground">Overall progress</p>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Curriculum status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Current week: </span>
            <span className="text-foreground">{workspace.currentWeekNumber ?? '—'}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Completed modules: </span>
            <span className="text-foreground">{workspace.completedModuleIds.length}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Locked modules: </span>
            <span className="text-foreground">{workspace.lockedModuleIds.length}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Enrollment status: </span>
            <span className="text-foreground">{workspace.status}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SubmissionsTab({ workspace }: { workspace: Workspace }) {
  if (workspace.submissions.length === 0) {
    return <EmptyState title="No submissions yet" description="Nothing submitted so far." />;
  }
  return (
    <div className="space-y-3">
      {workspace.submissions.map((submission) => (
        <Card key={submission.id} className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">{submission.taskTitle}</p>
            <p className="text-xs text-muted-foreground">
              {submission.submittedAt
                ? `Submitted ${new Date(submission.submittedAt).toLocaleDateString()}`
                : 'Not submitted'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {submission.repositoryUrl ? (
              <a
                href={submission.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
              >
                Repo <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
            <Badge tone={SUBMISSION_STATUS_TONE[submission.status]}>{submission.status}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PortfolioTab({ workspace }: { workspace: Workspace }) {
  if (workspace.portfolioProjects.length === 0) {
    return <EmptyState title="No portfolio projects yet" />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {workspace.portfolioProjects.map((project) => (
        <Card key={project.id} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-medium text-foreground">{project.title}</p>
            <Badge tone={project.visibility === 'public' ? 'success' : 'neutral'}>
              {project.visibility}
            </Badge>
          </div>
          {project.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
          ) : null}
          {project.technologies.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {project.technologies.map((tech) => (
                <Badge key={tech} tone="brand">
                  {tech}
                </Badge>
              ))}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

const noteSchema = z.object({ body: z.string().min(1, 'Note cannot be empty.').max(4000) });
type NoteFormValues = z.infer<typeof noteSchema>;

function NotesTab({ enrollmentId, notes }: { enrollmentId: string; notes: Workspace['notes'] }) {
  const createNote = useCreateMentorNote(enrollmentId);
  const updateNote = useUpdateMentorNote(enrollmentId);
  const deleteNote = useDeleteMentorNote(enrollmentId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState<{ id: string; version: number } | null>(null);

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { body: '' },
  });
  const editForm = useForm<NoteFormValues>({ resolver: zodResolver(noteSchema) });

  const errorMessage = createNote.error instanceof ApiError ? createNote.error.message : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle as="h2">Add a note</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <Alert variant="danger" className="mb-4">
              {errorMessage}
            </Alert>
          ) : null}
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
              await createNote.mutateAsync({ body: values.body });
              form.reset({ body: '' });
            })}
            noValidate
          >
            <TextareaField
              label="Note"
              rows={3}
              error={form.formState.errors.body?.message}
              {...form.register('body')}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={createNote.isPending}>
                Add note
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Notes you write here are visible to every mentor assigned to this cohort — never to students."
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) =>
            editingId === note.id ? (
              <Card key={note.id}>
                <CardContent>
                  <form
                    className="space-y-3"
                    onSubmit={editForm.handleSubmit(async (values) => {
                      await updateNote.mutateAsync({
                        noteId: note.id,
                        body: { body: values.body },
                        version: note.version,
                      });
                      setEditingId(null);
                    })}
                    noValidate
                  >
                    <TextareaField
                      label="Note"
                      rows={3}
                      error={editForm.formState.errors.body?.message}
                      {...editForm.register('body')}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button type="submit" loading={updateNote.isPending}>
                        Save
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card key={note.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label="Edit note"
                    onClick={() => {
                      editForm.reset({ body: note.body });
                      setEditingId(note.id);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete note"
                    onClick={() => setDeletingNote({ id: note.id, version: note.version })}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        open={deletingNote !== null}
        onClose={() => setDeletingNote(null)}
        onConfirm={async () => {
          if (!deletingNote) return;
          try {
            await deleteNote.mutateAsync({
              noteId: deletingNote.id,
              version: deletingNote.version,
            });
            setDeletingNote(null);
          } catch {
            // surfaced below via deleteNote.error
          }
        }}
        loading={deleteNote.isPending}
        error={deleteNote.error instanceof ApiError ? deleteNote.error.message : null}
        title="Delete this note?"
        description="Any mentor assigned to this cohort loses access to it."
        confirmLabel="Delete"
      />
    </div>
  );
}

function AttendanceTab({ workspace }: { workspace: Workspace }) {
  if (workspace.attendance.length === 0) {
    return <EmptyState title="No huddle attendance recorded yet" />;
  }
  return (
    <div className="space-y-2">
      {workspace.attendance.map((entry) => (
        <Card key={entry.id} className="flex items-center justify-between gap-3 py-4">
          <p className="text-sm font-medium text-foreground">Week {entry.weekNumber}</p>
          <Badge tone={ATTENDANCE_STATUS_TONE[entry.status]}>{entry.status}</Badge>
        </Card>
      ))}
    </div>
  );
}
