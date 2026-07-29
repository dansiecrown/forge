import { Loader2, CheckCircle2, Circle, Bookmark, ExternalLink } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAcknowledgeResource,
  useWeeklyModule,
} from '@/features/student-curriculum/hooks/use-student-curriculum';

export function WeeklyModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { data: module, isLoading, error } = useWeeklyModule(moduleId);
  const acknowledge = useAcknowledgeResource();

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !module) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Weekly module not found.'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Week ${module.weekNumber}: ${module.title}`}
        description={
          <Link to="/portal/weekly-learning" className="text-brand hover:underline">
            Back to Weekly Learning
          </Link>
        }
        action={
          <Badge tone={module.lockState === 'completed' ? 'success' : 'brand'}>
            {module.lockState}
          </Badge>
        }
      />

      {module.summary ? <p className="text-sm text-muted-foreground">{module.summary}</p> : null}

      {module.objectives.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Objectives</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {module.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {module.requiresMentorHuddle ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Mentor huddle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {module.huddleMeetingLink ? (
              <p>
                <a
                  href={module.huddleMeetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  Join meeting link <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </p>
            ) : (
              <p className="text-muted-foreground">A mentor huddle is scheduled for this week.</p>
            )}
            {module.mentorHuddleNotes ? (
              <p className="text-muted-foreground">{module.mentorHuddleNotes}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          {module.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons in this week yet.</p>
          ) : (
            <ul className="space-y-1">
              {module.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    to={`/portal/lessons/${lesson.id}`}
                    className="flex items-center gap-2.5 rounded-control px-2 py-2 text-sm transition-colors duration-150 hover:bg-surface-2"
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <Circle
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-foreground">{lesson.title}</span>
                    {!lesson.completionRequired ? (
                      <Badge tone="neutral" className="ml-auto">
                        optional
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Learning resources</CardTitle>
        </CardHeader>
        <CardContent>
          {module.resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources in this week yet.</p>
          ) : (
            <ul className="space-y-1">
              {module.resources.map((resource) => (
                <li key={resource.id} className="flex items-center gap-2.5 px-2 py-2 text-sm">
                  {resource.acknowledged ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  {resource.url ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground hover:text-brand"
                    >
                      {resource.title}
                    </a>
                  ) : (
                    <span className="text-foreground">{resource.title}</span>
                  )}
                  {resource.isRequired ? (
                    <Badge tone="neutral" className="ml-auto">
                      required
                    </Badge>
                  ) : null}
                  {resource.bookmarked ? (
                    <Bookmark
                      className="size-3.5 shrink-0 fill-current text-brand"
                      aria-hidden="true"
                    />
                  ) : null}
                  {!resource.acknowledged ? (
                    <Button
                      variant="tertiary"
                      className="ml-auto h-auto min-h-0 px-1 py-0 text-xs"
                      loading={acknowledge.isPending}
                      onClick={() => acknowledge.mutate(resource.id)}
                    >
                      Mark complete
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {module.requiresPracticalWork ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Practical tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {module.practicalTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No practical tasks in this week yet.</p>
            ) : (
              <ul className="space-y-1">
                {module.practicalTasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      to={`/portal/practical-tasks/${task.id}`}
                      className="flex items-center justify-between gap-2.5 rounded-control px-2 py-2 text-sm transition-colors duration-150 hover:bg-surface-2"
                    >
                      <span className="text-foreground">{task.title}</span>
                      <Badge tone={task.submission?.status === 'submitted' ? 'success' : 'neutral'}>
                        {task.submission?.status ?? 'not started'}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
