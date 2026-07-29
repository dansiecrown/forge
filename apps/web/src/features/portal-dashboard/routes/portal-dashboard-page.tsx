import { Loader2, ArrowRight, Flame, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/portal/empty-state';
import { ProgressRing } from '@/components/portal/progress-ring';
import { useSession } from '@/contexts/session-context';
import { useDashboard } from '@/features/student-curriculum/hooks/use-student-curriculum';

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function PortalDashboardPage() {
  const { user } = useSession();
  const { data: dashboard, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <EmptyState
        title="We couldn't load your dashboard."
        description="Please try again shortly."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Welcome back
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {user?.displayName}
        </h1>
      </div>

      {!dashboard.hasActiveTrack ? (
        <EmptyState
          title="No active learning track yet"
          description="Your fellowship administrator hasn't assigned you a learning track. Check back soon."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <Card className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <ProgressRing percent={dashboard.progressPercent} size={112} />
              <p className="text-sm text-muted-foreground">Overall progress</p>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="flex items-center gap-3 py-5">
                <Flame className="size-6 text-warning" aria-hidden="true" />
                <div>
                  <p className="text-xl font-semibold text-foreground">{dashboard.streakDays}</p>
                  <p className="text-sm text-muted-foreground">day streak</p>
                </div>
              </Card>
              <Card className="flex items-center gap-3 py-5">
                <Clock className="size-6 text-brand" aria-hidden="true" />
                <div>
                  <p className="text-xl font-semibold text-foreground">
                    {formatMinutes(dashboard.estimatedMinutesLearned)}
                  </p>
                  <p className="text-sm text-muted-foreground">estimated time learned</p>
                </div>
              </Card>
            </div>
          </div>

          {dashboard.nextUp ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Continue learning</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Next lesson</p>
                    <p className="text-base font-medium text-foreground">
                      {dashboard.nextUp.title}
                    </p>
                  </div>
                  <Link
                    to={`/portal/lessons/${dashboard.nextUp.lessonId}`}
                    className={buttonVariants({ variant: 'primary' })}
                  >
                    Continue learning
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">You're all caught up</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No required lessons left in your current week.{' '}
                  <Link to="/portal/weekly-learning" className="text-brand hover:underline">
                    Review your weekly learning
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle as="h2">Upcoming deadlines</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.upcomingDeadlines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing due right now.</p>
                ) : (
                  <ul className="space-y-3">
                    {dashboard.upcomingDeadlines.map((deadline) => (
                      <li key={deadline.taskId}>
                        <Link
                          to={`/portal/practical-tasks/${deadline.taskId}`}
                          className="flex items-center justify-between gap-3 text-sm hover:text-brand"
                        >
                          <span className="font-medium text-foreground">{deadline.title}</span>
                          <Badge tone="warning">
                            Due {new Date(deadline.dueDate).toLocaleDateString()}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet — get started!</p>
                ) : (
                  <ul className="space-y-2">
                    {dashboard.recentActivity.slice(0, 5).map((item) => (
                      <li key={`${item.type}-${item.id}`} className="text-sm">
                        <span className="text-foreground">{item.title}</span>{' '}
                        <span className="text-muted-foreground">
                          &middot; {new Date(item.occurredAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {dashboard.estimatedCompletionDate ? (
            <p className="text-sm text-muted-foreground">
              Estimated completion:{' '}
              {new Date(dashboard.estimatedCompletionDate).toLocaleDateString()}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
