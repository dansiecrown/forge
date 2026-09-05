import { Loader2, Lock, CheckCircle2, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/portal/empty-state';
import { useWeeklyModules } from '@/features/student-curriculum/hooks/use-student-curriculum';

const LOCK_STATE_TONE: Record<string, BadgeProps['tone']> = {
  completed: 'success',
  current: 'brand',
  locked: 'neutral',
};

const LOCK_STATE_ICON = {
  completed: CheckCircle2,
  current: PlayCircle,
  locked: Lock,
};

export function WeeklyLearningPage() {
  const { data: modules, isLoading, error } = useWeeklyModules();

  return (
    <div>
      <AdminPageHeader
        title="Weekly Learning"
        description="Your fellowship's curriculum, one week at a time."
      />

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : error || !modules ? (
        <EmptyState title="We couldn't load your weekly modules." />
      ) : modules.length === 0 ? (
        <EmptyState
          title="No learning track assigned yet"
          description="Check back once your fellowship administrator assigns your track."
        />
      ) : (
        <div className="space-y-3">
          {modules.map((module) => {
            const Icon = LOCK_STATE_ICON[module.lockState];
            const content = (
              <Card
                className={
                  module.lockState === 'locked'
                    ? 'opacity-70'
                    : 'transition-colors hover:bg-surface-2'
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Icon
                      className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Week {module.weekNumber}
                      </p>
                      <p className="text-base font-medium text-foreground">{module.title}</p>
                      {module.summary ? (
                        <p className="mt-1 text-sm text-muted-foreground">{module.summary}</p>
                      ) : null}
                      {module.lockState === 'locked' ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Complete the current week to unlock this one.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {module.lessonCount} lesson{module.lessonCount === 1 ? '' : 's'} &middot;{' '}
                          {module.resourceCount} resource{module.resourceCount === 1 ? '' : 's'}
                          {module.requiresPracticalWork
                            ? ` · ${module.taskCount} task${module.taskCount === 1 ? '' : 's'}`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge tone={LOCK_STATE_TONE[module.lockState]}>{module.lockState}</Badge>
                </div>
              </Card>
            );

            return module.lockState === 'locked' ? (
              <div key={module.id}>{content}</div>
            ) : (
              <Link key={module.id} to={`/portal/weekly-learning/${module.id}`} className="block">
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
