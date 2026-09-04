import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BarChart } from '@/components/admin/bar-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/portal/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardErrorPanel, DashboardState } from '@/components/dashboard-state';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getAdminDashboard } from '../api/admin-dashboard-api';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card glass className="flex flex-col justify-center gap-1 p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}

export function AdminDashboardPage() {
  const { activeOrganizationId } = useActiveOrganization();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-dashboard', activeOrganizationId],
    queryFn: () => getAdminDashboard(activeOrganizationId),
  });

  const isEmpty = data ? data.organizationCount === 0 : false;
  const status = isLoading ? 'loading' : error ? 'error' : isEmpty ? 'empty' : 'success';

  const trendData = (data?.enrollmentTrend ?? []).map((point) => ({
    label: point.weekStart.slice(5),
    value: point.count,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Platform-wide overview — organizations, academies, fellowships, cohorts, and activity."
      />

      <DashboardState status={status}>
        <DashboardState.Loading>
          <DashboardSkeleton />
        </DashboardState.Loading>

        <DashboardState.Error>
          <DashboardErrorPanel
            description={error instanceof ApiError ? error.message : 'Please try again.'}
            onRetry={() => void refetch()}
          />
        </DashboardState.Error>

        <DashboardState.Empty>
          <EmptyState
            title="Nothing provisioned yet"
            description="Once an organization is created, its overview will appear here."
          />
        </DashboardState.Empty>

        <DashboardState.Content>
          {data ? (
            <div className="space-y-4" aria-label="Platform overview">
              {/* Focal row: the one real trend this platform has, beside its single
                  most-watched headline number — the asymmetric hero of the page. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
                <Card glass className="flex flex-col" aria-label="Weekly enrollment trend">
                  <CardHeader>
                    <CardTitle as="h2">Weekly enrollment</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 items-center">
                    {trendData.length > 0 ? (
                      <BarChart data={trendData} className="w-full" />
                    ) : (
                      <p className="text-sm text-muted-foreground">No enrollment activity yet.</p>
                    )}
                  </CardContent>
                </Card>
                <Card glass className="flex flex-col justify-center gap-1 p-6">
                  <p className="text-sm text-muted-foreground">Active students</p>
                  <p className="text-5xl font-semibold tracking-tight text-foreground">
                    {data.activeStudentCount}
                  </p>
                </Card>
              </div>

              {/* Exactly 8 tiles — divides evenly at both grid-cols-2 and
                  grid-cols-4, so the last row is never left ragged with an
                  empty trailing column. Active students repeats the hero
                  number above; a small, deliberate redundancy in exchange
                  for a grid that never looks broken regardless of viewport. */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Active students" value={data.activeStudentCount} />
                <StatTile label="Completion rate" value={data.completionRate} />
                <StatTile label="Active mentors" value={data.activeMentorCount} />
                <StatTile label="Pending reviews" value={data.pendingReviewCount} />
                <StatTile label="Organizations" value={data.organizationCount} />
                <StatTile label="Academies" value={data.academyCount} />
                <StatTile label="Fellowships" value={data.fellowshipCount} />
                <StatTile label="Cohorts" value={data.cohortCount} />
              </div>

              <Card glass>
                <CardHeader>
                  <CardTitle as="h2">Recent activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.recentActivity.map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{entry.action}</span>
                          <span className="text-muted-foreground">
                            {new Date(entry.occurredAt).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DashboardState.Content>
      </DashboardState>
    </div>
  );
}
