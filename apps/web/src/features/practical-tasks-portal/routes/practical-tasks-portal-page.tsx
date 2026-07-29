import { useNavigate } from 'react-router-dom';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable } from '@/components/admin/data-table';
import type { StudentTaskSummary } from '@forge/api-contract';
import { usePracticalTasks } from '@/features/student-curriculum/hooks/use-student-curriculum';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  submitted: 'success',
  under_review: 'brand',
  revision_requested: 'warning',
  completed: 'success',
};

function isOverdue(task: StudentTaskSummary): boolean {
  const submittedStatus = task.submission?.status;
  const actuallySubmitted = submittedStatus && submittedStatus !== 'draft';
  return (
    Boolean(task.dueDate) && !actuallySubmitted && new Date(task.dueDate as string) < new Date()
  );
}

export function PracticalTasksPortalPage() {
  const navigate = useNavigate();
  const { data: tasks, isLoading, error } = usePracticalTasks();

  return (
    <div>
      <AdminPageHeader
        title="Practical Tasks"
        description="Hands-on work for your current and completed weeks."
      />
      <DataTable
        columns={[
          {
            key: 'title',
            header: 'Task',
            render: (task: StudentTaskSummary) => (
              <div>
                <p className="font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  Week {task.weekNumber} &middot; {task.moduleTitle}
                </p>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (task) => (
              <Badge tone={STATUS_TONE[task.submission?.status ?? 'draft']}>
                {task.submission?.status ?? 'not started'}
              </Badge>
            ),
          },
          {
            key: 'due',
            header: 'Due date',
            render: (task) =>
              task.dueDate ? (
                <span className={isOverdue(task) ? 'text-danger' : 'text-foreground'}>
                  {new Date(task.dueDate).toLocaleDateString()}
                  {isOverdue(task) ? ' (overdue)' : ''}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ]}
        rows={tasks ?? []}
        rowKey={(task) => task.id}
        isLoading={isLoading}
        error={error as Error | null}
        emptyTitle="No practical tasks yet"
        emptyDescription="Tasks appear here once your current week requires practical work."
        onRowClick={(task) => navigate(`/portal/practical-tasks/${task.id}`)}
      />
    </div>
  );
}
