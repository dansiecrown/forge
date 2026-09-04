import { ArrowRight, Flame, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/portal/empty-state';
import { ProgressRing } from '@/components/portal/progress-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardErrorPanel, DashboardState } from '@/components/dashboard-state';
import { useSession } from '@/contexts/session-context';
import { useDashboard } from '@/features/student-curriculum/hooks/use-student-curriculum';
import { cn } from '@/utils';

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function KpiTile({ icon: Icon, tone, value, label }: KpiTileProps) {
  return (
    <Card glass className="flex items-center gap-3 p-5">
      <Icon className={cn('size-6 shrink-0', tone)} aria-hidden="true" />
      <div>
        <p className="text-xl font-semibold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

interface KpiTileProps {
  icon: typeof Flame;
  tone: string;
  value: string | number;
  label: string;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-56" />
        <div className="grid gap-4">
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

export function PortalDashboardPage() {
  const { user } = useSession();
  const { data: dashboard, isLoading, error, refetch } = useDashboard();

  const isEmpty = dashboard ? !dashboard.hasActiveTrack : false;
  const status = isLoading ? 'loading' : error ? 'error' : isEmpty ? 'empty' : 'success';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{user?.displayName}</h1>

      <DashboardState status={status}>
        <DashboardState.Loading>
          <DashboardSkeleton />
        </DashboardState.Loading>

        <DashboardState.Error>
          <DashboardErrorPanel onRetry={() => void refetch()} />
        </DashboardState.Error>

        <DashboardState.Empty>
          <EmptyState
            title="No active learning track yet"
            description="Your fellowship administrator hasn't assigned you a learning track. Check back soon."
          />
        </DashboardState.Empty>

        <DashboardState.Content>
          {dashboard ? (
            <div className="space-y-4">
              {/* Focal row: progress + what to do next, merged into one hero tile —
                  previously two separate small cards competing for attention. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
                <Card
                  glass
                  className="flex flex-col justify-center gap-6 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <ProgressRing percent={dashboard.progressPercent} size={96} />
                    <p className="text-sm text-muted-foreground">Overall progress</p>
                  </div>
                  <div className="h-px w-full bg-border sm:h-16 sm:w-px" aria-hidden="true" />
                  {dashboard.nextUp ? (
                    <div className="flex flex-1 flex-wrap items-center justify-between gap-4">
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
                  ) : (
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-base font-medium text-foreground">
                        You&apos;re all caught up
                      </p>
                      <p className="text-sm text-muted-foreground">
                        No required lessons left in your current week.{' '}
                        <Link to="/portal/weekly-learning" className="text-brand hover:underline">
                          Review your weekly learning
                        </Link>
                        .
                      </p>
                    </div>
                  )}
                </Card>

                {/* flex + justify-between, not grid — a grid top-packs its
                    items and leaves dead space below the last tile once this
                    column is stretched to match the taller hero card beside
                    it; flex distributes the gap instead. */}
                <div className="flex h-full flex-col justify-between gap-4">
                  <KpiTile
                    icon={Flame}
                    tone="text-warning"
                    value={dashboard.streakDays}
                    label="day streak"
                  />
                  <KpiTile
                    icon={Clock}
                    tone="text-brand"
                    value={formatMinutes(dashboard.estimatedMinutesLearned)}
                    label="estimated time learned"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card glass>
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
                              className="flex items-center justify-between gap-3 rounded-control text-sm hover:text-brand"
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

                <Card glass>
                  <CardHeader>
                    <CardTitle as="h2">Recent activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboard.recentActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No activity yet — get started!
                      </p>
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
            </div>
          ) : null}
        </DashboardState.Content>
      </DashboardState>
    </div>
  );
}
