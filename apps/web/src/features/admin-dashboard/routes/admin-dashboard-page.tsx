import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BarChart } from '@/components/admin/bar-chart';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useActiveOrganization } from '@/contexts/organization-context';
import { getAdminDashboard } from '../api/admin-dashboard-api';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
    </Card>
  );
}

export function AdminDashboardPage() {
  const { activeOrganizationId } = useActiveOrganization();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-dashboard', activeOrganizationId],
    queryFn: () => getAdminDashboard(activeOrganizationId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Could not load the dashboard.'}
      </Alert>
    );
  }

  const trendData = data.enrollmentTrend.map((point) => ({
    label: point.weekStart.slice(5),
    value: point.count,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Platform-wide overview — organizations, academies, fellowships, cohorts, and activity."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Organizations" value={data.organizationCount} />
        <StatCard label="Academies" value={data.academyCount} />
        <StatCard label="Fellowships" value={data.fellowshipCount} />
        <StatCard label="Cohorts" value={data.cohortCount} />
        <StatCard label="Active students" value={data.activeStudentCount} />
        <StatCard label="Active mentors" value={data.activeMentorCount} />
        <StatCard label="Pending reviews" value={data.pendingReviewCount} />
        <StatCard label="Completion rate" value={data.completionRate} />
      </div>

      {trendData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Weekly enrollment</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={trendData} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
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
  );
}
