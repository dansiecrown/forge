import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BarChart } from '@/components/admin/bar-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  getAttendanceStats,
  getCompletionRates,
  getEnrollmentTrends,
  getMentorActivity,
  getSubmissionStats,
} from '../api/reports-api';

export function ReportsPage() {
  const { activeOrganizationId } = useActiveOrganization();
  const [cohortId, setCohortId] = useState('');
  const [fellowshipId, setFellowshipId] = useState('');

  const trends = useQuery({
    queryKey: ['reports', 'enrollment-trends', activeOrganizationId],
    queryFn: () => getEnrollmentTrends(activeOrganizationId as string),
    enabled: Boolean(activeOrganizationId),
  });
  const mentorActivity = useQuery({
    queryKey: ['reports', 'mentor-activity', activeOrganizationId],
    queryFn: () => getMentorActivity(activeOrganizationId as string),
    enabled: Boolean(activeOrganizationId),
  });
  const submissionStats = useQuery({
    queryKey: ['reports', 'submission-stats', activeOrganizationId, cohortId],
    queryFn: () => getSubmissionStats(activeOrganizationId as string, cohortId || undefined),
    enabled: Boolean(activeOrganizationId),
  });
  const attendanceStats = useQuery({
    queryKey: ['reports', 'attendance-stats', cohortId, activeOrganizationId],
    queryFn: () => getAttendanceStats(cohortId, activeOrganizationId),
    enabled: Boolean(cohortId && activeOrganizationId),
  });
  const completionRates = useQuery({
    queryKey: ['reports', 'completion-rates', fellowshipId, activeOrganizationId],
    queryFn: () => getCompletionRates(fellowshipId, activeOrganizationId),
    enabled: Boolean(fellowshipId && activeOrganizationId),
  });

  const trendData = (trends.data ?? []).map((p) => ({
    label: p.weekStart.slice(5),
    value: p.count,
  }));
  const submissionData = Object.entries(submissionStats.data ?? {}).map(([label, value]) => ({
    label,
    value,
  }));
  const attendanceData = Object.entries(attendanceStats.data ?? {}).map(([label, value]) => ({
    label,
    value,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reports & Analytics"
        description="Simple charts — enrollment, completion, activity, and submission trends."
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Weekly enrollment</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <BarChart data={trendData} />
          ) : (
            <p className="text-sm text-muted-foreground">No enrollment activity yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Mentor activity</CardTitle>
        </CardHeader>
        <CardContent>
          {mentorActivity.data && mentorActivity.data.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {mentorActivity.data.map((row) => (
                <li key={row.membershipId} className="flex justify-between">
                  <span className="text-muted-foreground">
                    Mentor {row.membershipId.slice(0, 8)}
                  </span>
                  <span className="text-foreground">
                    {row.huddlesRecorded} huddles · {row.reviewsRecorded} reviews
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No mentor activity recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Submission statistics</CardTitle>
          <p className="text-sm text-muted-foreground">
            Optionally scope to one cohort using the field below.
          </p>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Cohort id (optional)…"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            aria-label="Cohort id"
            className="mb-4 max-w-sm"
          />
          {submissionData.length > 0 ? (
            <BarChart data={submissionData} />
          ) : (
            <p className="text-sm text-muted-foreground">No submissions recorded yet.</p>
          )}
          {cohortId && attendanceData.length > 0 ? (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-foreground">Attendance for this cohort</p>
              <BarChart data={attendanceData} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Fellowship completion</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Fellowship id…"
            value={fellowshipId}
            onChange={(e) => setFellowshipId(e.target.value)}
            aria-label="Fellowship id"
            className="mb-4 max-w-sm"
          />
          {completionRates.data ? (
            <p className="text-sm text-foreground">
              {completionRates.data.completedCount} of {completionRates.data.enrollmentCount}{' '}
              enrollments completed across {completionRates.data.cohortCount} cohorts.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Enter a fellowship id to see its stats.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
