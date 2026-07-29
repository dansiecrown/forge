import { Loader2, ChevronLeft, ChevronRight, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  useCompleteLesson,
  useLesson,
} from '@/features/student-curriculum/hooks/use-student-curriculum';

const EMBEDDABLE_TYPES = new Set(['video', 'embedded_content']);

function estimateReadingTime(minutes: number | null): string {
  if (!minutes) return '';
  return `${minutes} min`;
}

export function LessonReaderPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { data: lesson, isLoading, error } = useLesson(lessonId);
  const completeLesson = useCompleteLesson();

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Lesson not found.'}
      </Alert>
    );
  }

  const canEmbed = EMBEDDABLE_TYPES.has(lesson.lessonType) && Boolean(lesson.resourceUrl);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/portal/weekly-learning" className="hover:text-brand">
          Weekly Learning
        </Link>
        {' / '}
        <Link to={`/portal/weekly-learning/${lesson.moduleId}`} className="hover:text-brand">
          Week {lesson.weekNumber}: {lesson.moduleTitle}
        </Link>
      </nav>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lesson.title}</h1>
          {lesson.completed ? (
            <Badge tone="success">
              <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
              Completed
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {lesson.lessonType.replace(/_/g, ' ')}
          {lesson.estimatedDurationMinutes
            ? ` · ${estimateReadingTime(lesson.estimatedDurationMinutes)}`
            : ''}
        </p>
      </div>

      {canEmbed ? (
        <div className="aspect-video overflow-hidden rounded-card border border-border bg-black">
          <iframe
            src={lesson.resourceUrl ?? undefined}
            title={lesson.title}
            className="size-full"
            allowFullScreen
          />
        </div>
      ) : null}

      {lesson.description ? (
        <Card>
          <div className="prose-sm whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {lesson.description}
          </div>
        </Card>
      ) : null}

      {!canEmbed && lesson.resourceUrl ? (
        <a
          href={lesson.resourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
        >
          Open resource <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <div className="flex gap-2">
          {lesson.previousLessonId ? (
            <Link
              to={`/portal/lessons/${lesson.previousLessonId}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Link>
          ) : null}
          {lesson.nextLessonId ? (
            <Link
              to={`/portal/lessons/${lesson.nextLessonId}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <Button
          variant={lesson.completed ? 'secondary' : 'primary'}
          loading={completeLesson.isPending}
          disabled={lesson.completed}
          onClick={() => completeLesson.mutate(lesson.id)}
        >
          {lesson.completed ? (
            <>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Completed
            </>
          ) : (
            'Mark complete'
          )}
        </Button>
      </div>
    </div>
  );
}
