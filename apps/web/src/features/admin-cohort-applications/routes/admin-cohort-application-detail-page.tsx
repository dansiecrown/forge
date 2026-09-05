import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  useCohortApplication,
  useCohortApplicationActions,
} from '../hooks/use-admin-cohort-applications';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  pending: 'brand',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

export function AdminCohortApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: application, isLoading, error } = useCohortApplication(id);
  const { approve, reject } = useCohortApplicationActions(id ?? '');
  const [confirmingReject, setConfirmingReject] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Application not found.'}
      </Alert>
    );
  }

  async function onConfirmReject(reason?: string) {
    if (!application) return;
    try {
      await reject.mutateAsync({ version: application.version, reason: reason || undefined });
      setConfirmingReject(false);
    } catch {
      // surfaced below via reject.error
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={application.prospectDisplayName ?? 'Existing member application'}
        description={
          <>
            <Link to="/admin/applications" className="text-brand hover:underline">
              Applications
            </Link>{' '}
            / {application.prospectEmail ?? application.applicantUserId}
          </>
        }
        action={<Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle as="h2">Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Submitted</span>{' '}
            {new Date(application.createdAt).toLocaleString()}
          </p>
          {application.note ? (
            <p>
              <span className="text-muted-foreground">Note:</span> {application.note}
            </p>
          ) : null}
          {application.reviewedAt ? (
            <p>
              <span className="text-muted-foreground">Reviewed</span>{' '}
              {new Date(application.reviewedAt).toLocaleString()}
            </p>
          ) : null}
          {application.rejectionReason ? (
            <p>
              <span className="text-muted-foreground">Rejection reason:</span>{' '}
              {application.rejectionReason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {application.status === 'pending' ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle as="h2">Decision</CardTitle>
          </CardHeader>
          <CardContent>
            {(approve.error ?? reject.error) ? (
              <Alert variant="danger" className="mb-4">
                {approve.error instanceof ApiError
                  ? approve.error.message
                  : reject.error instanceof ApiError
                    ? reject.error.message
                    : 'Could not complete this action.'}
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                loading={approve.isPending}
                onClick={() => approve.mutate(application.version)}
              >
                Approve
              </Button>
              <Button variant="destructive" onClick={() => setConfirmingReject(true)}>
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmingReject}
        onClose={() => setConfirmingReject(false)}
        onConfirm={onConfirmReject}
        loading={reject.isPending}
        error={reject.error instanceof ApiError ? reject.error.message : null}
        title="Reject this application?"
        description="The applicant will be notified."
        reasonLabel="Reason (optional)"
        reasonRequired={false}
        confirmLabel="Reject"
      />
    </div>
  );
}
