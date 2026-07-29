import { BookOpen, CheckCircle2, ClipboardCheck, FileText, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { EmptyState } from '@/components/portal/empty-state';
import { ProgressRing } from '@/components/portal/progress-ring';
import { Timeline } from '@/components/portal/timeline';
import type { StudentActivityItem } from '@forge/api-contract';
import {
  useActivity,
  useDashboard,
  useWeeklyModules,
} from '@/features/student-curriculum/hooks/use-student-curriculum';

const LOCK_STATE_TONE: Record<string, BadgeProps['tone']> = {
  completed: 'success',
  current: 'brand',
  locked: 'neutral',
};

const ACTIVITY_ICON: Record<StudentActivityItem['type'], typeof BookOpen> = {
  lesson: BookOpen,
  resource: FileText,
  task: ClipboardCheck,
};

export function ProgressCenterPage() {
  const { data: dashboard, isLoading: dashboardLoading } = useDashboard();
  const { data: modules, isLoading: modulesLoading } = useWeeklyModules();
  const { data: activity, isLoading: activityLoading } = useActivity(30);

  const isLoading = dashboardLoading || modulesLoading || activityLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (!dashboard?.hasActiveTrack) {
    return (
      <div>
        <AdminPageHeader title="Progress" />
        <EmptyState title="No active learning track yet" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Progress" description="Your learning journey, week by week." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col items-center gap-2 py-6 text-center">
          <ProgressRing percent={dashboard.progressPercent} size={88} />
          <p className="text-sm text-muted-foreground">Overall completion</p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="text-2xl font-semibold text-foreground">{dashboard.streakDays}</p>
          <p className="text-sm text-muted-foreground">day streak</p>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="text-2xl font-semibold text-foreground">
            {modules?.filter((m) => m.lockState === 'completed').length ?? 0}
          </p>
          <p className="text-sm text-muted-foreground">weeks completed</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Weekly progress</CardTitle>
        </CardHeader>
        <CardContent>
          {!modules || modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules yet.</p>
          ) : (
            <ul className="space-y-3">
              {modules.map((module) => (
                <li key={module.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {module.lockState === 'completed' ? (
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <div
                        className="size-4 rounded-full border border-border"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-sm text-foreground">
                      Week {module.weekNumber}: {module.title}
                    </span>
                  </div>
                  <Badge tone={LOCK_STATE_TONE[module.lockState]}>{module.lockState}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Activity timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {!activity || activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <Timeline
              items={activity.map((item) => {
                const Icon = ACTIVITY_ICON[item.type];
                return {
                  id: `${item.type}-${item.id}`,
                  icon: <Icon className="size-4" aria-hidden="true" />,
                  title: item.title,
                  meta: new Date(item.occurredAt).toLocaleString(),
                };
              })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
