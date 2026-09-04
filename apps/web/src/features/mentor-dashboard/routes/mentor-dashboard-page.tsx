import { AlertTriangle, ClipboardCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AtRiskBadge } from '@/components/mentor/at-risk-badge';
import { EmptyState } from '@/components/portal/empty-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardErrorPanel, DashboardState } from '@/components/dashboard-state';
import { useSession } from '@/contexts/session-context';
import { useMentorDashboard } from '@/features/mentor-workspace/hooks/use-mentor-workspace';
import { cn } from '@/utils';

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
  icon: typeof Users;
  tone: string;
  value: number;
  label: string;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72" />
        <div className="grid gap-4">
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
          <Skeleton className="h-[88px]" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

export function MentorDashboardPage() {
  const { user } = useSession();
  const { data: dashboard, isLoading, error, refetch } = useMentorDashboard();

  const isEmpty = dashboard ? dashboard.cohorts.length === 0 : false;
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
            title="No cohorts assigned yet"
            description="Once an admin assigns you as a mentor to a cohort, it will appear here."
          />
        </DashboardState.Empty>

        <DashboardState.Content>
          {dashboard ? (
            <div className="space-y-4">
              {/* Focal row: the review queue is the one thing a mentor actually
                  needs to act on today — the KPI counts are context, not the point. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
                <Card glass aria-label="Review queue">
                  <CardHeader>
                    <CardTitle as="h2">Review queue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboard.reviewQueue.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nothing pending review.</p>
                    ) : (
                      <ul className="space-y-3">
                        {dashboard.reviewQueue.slice(0, 5).map((item) => (
                          <li key={item.submissionId}>
                            <Link
                              to={`/mentor/submissions/${item.submissionId}`}
                              className="flex items-center justify-between gap-3 rounded-control text-sm hover:text-brand"
                            >
                              <span>
                                <span className="font-medium text-foreground">
                                  {item.studentDisplayName}
                                </span>{' '}
                                <span className="text-muted-foreground">
                                  &middot; {item.taskTitle}
                                </span>
                              </span>
                              {item.isResubmission ? (
                                <Badge tone="brand">Resubmission</Badge>
                              ) : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {dashboard.reviewQueue.length > 0 ? (
                      <Link
                        to="/mentor/review-queue"
                        className={cn(buttonVariants({ variant: 'tertiary' }), 'mt-4')}
                      >
                        View all
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>

                <div className="grid gap-4">
                  <KpiTile
                    icon={Users}
                    tone="text-brand"
                    value={dashboard.cohorts.length}
                    label="assigned cohorts"
                  />
                  <KpiTile
                    icon={AlertTriangle}
                    tone="text-warning"
                    value={dashboard.atRiskStudents.length}
                    label="students at risk"
                  />
                  <KpiTile
                    icon={ClipboardCheck}
                    tone="text-success"
                    value={dashboard.reviewQueue.length}
                    label="submissions pending review"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card glass>
                  <CardHeader>
                    <CardTitle as="h2">Students at risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboard.atRiskStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No students flagged right now.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {dashboard.atRiskStudents.slice(0, 5).map((student) => (
                          <li key={student.enrollmentId}>
                            <Link
                              to={`/mentor/students/${student.enrollmentId}`}
                              className="flex items-center justify-between gap-3 rounded-control text-sm hover:text-brand"
                            >
                              <span className="font-medium text-foreground">
                                {student.displayName}
                              </span>
                              <AtRiskBadge atRisk={student.atRisk} reason={student.atRiskReason} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card glass>
                  <CardHeader>
                    <CardTitle as="h2">Recent huddles &amp; notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium text-foreground">Huddles</p>
                      {dashboard.recentHuddleSessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No huddles recorded yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {dashboard.recentHuddleSessions.map((session) => (
                            <li key={session.id} className="text-sm text-foreground">
                              Week {session.weekNumber}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium text-foreground">Your recent notes</p>
                      {dashboard.recentNotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No notes written yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {dashboard.recentNotes.map((note) => (
                            <li key={note.id} className="line-clamp-1 text-sm text-foreground">
                              {note.body}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </DashboardState.Content>
      </DashboardState>
    </div>
  );
}
