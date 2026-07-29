import { AlertTriangle, ClipboardCheck, Loader2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AtRiskBadge } from '@/components/mentor/at-risk-badge';
import { EmptyState } from '@/components/portal/empty-state';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/contexts/session-context';
import { useMentorDashboard } from '@/features/mentor-workspace/hooks/use-mentor-workspace';
import { cn } from '@/utils';

export function MentorDashboardPage() {
  const { user } = useSession();
  const { data: dashboard, isLoading, error } = useMentorDashboard();

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

      {dashboard.cohorts.length === 0 ? (
        <EmptyState
          title="No cohorts assigned yet"
          description="Once an admin assigns you as a mentor to a cohort, it will appear here."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-3 py-5">
              <Users className="size-6 text-brand" aria-hidden="true" />
              <div>
                <p className="text-xl font-semibold text-foreground">{dashboard.cohorts.length}</p>
                <p className="text-sm text-muted-foreground">assigned cohorts</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 py-5">
              <AlertTriangle className="size-6 text-warning" aria-hidden="true" />
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {dashboard.atRiskStudents.length}
                </p>
                <p className="text-sm text-muted-foreground">students at risk</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 py-5">
              <ClipboardCheck className="size-6 text-success" aria-hidden="true" />
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {dashboard.reviewQueue.length}
                </p>
                <p className="text-sm text-muted-foreground">submissions pending review</p>
              </div>
            </Card>
          </div>

          <Card>
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
                        className="flex items-center justify-between gap-3 text-sm hover:text-brand"
                      >
                        <span>
                          <span className="font-medium text-foreground">
                            {item.studentDisplayName}
                          </span>{' '}
                          <span className="text-muted-foreground">&middot; {item.taskTitle}</span>
                        </span>
                        {item.isResubmission ? <Badge tone="brand">Resubmission</Badge> : null}
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

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle as="h2">Students at risk</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.atRiskStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students flagged right now.</p>
                ) : (
                  <ul className="space-y-3">
                    {dashboard.atRiskStudents.slice(0, 5).map((student) => (
                      <li key={student.enrollmentId}>
                        <Link
                          to={`/mentor/students/${student.enrollmentId}`}
                          className="flex items-center justify-between gap-3 text-sm hover:text-brand"
                        >
                          <span className="font-medium text-foreground">{student.displayName}</span>
                          <AtRiskBadge atRisk={student.atRisk} reason={student.atRiskReason} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">Recent huddles &amp; notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Huddles
                  </p>
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
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Your recent notes
                  </p>
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
        </>
      )}
    </div>
  );
}
