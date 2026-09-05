import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/portal/empty-state';
import { CatalogPicker, type CatalogSelection, usePublicCatalog } from '@/features/apply';
import {
  useMyApplications,
  useSubmitStudentApplication,
  useWithdrawApplication,
} from '../hooks/use-cohort-applications';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  pending: 'brand',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

/** Authenticated self-service registration — an existing student applying
 * to another public cohort within their own organization. Reuses the same
 * `CatalogPicker` the anonymous `/apply` page uses; submits via the
 * authenticated endpoint instead. See docs/adr/0010-cohort-applications.md. */
export function StudentRegisterPage() {
  const { fellowships, isLoading: catalogLoading, error: catalogError } = usePublicCatalog();
  const { data: applications, isLoading: applicationsLoading } = useMyApplications();
  const submit = useSubmitStudentApplication();
  const withdraw = useWithdrawApplication();
  const [selection, setSelection] = useState<CatalogSelection>({
    cohortId: undefined,
    requestedLearningTrackId: undefined,
  });
  const [withdrawing, setWithdrawing] = useState<{ id: string; version: number } | null>(null);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Apply to a cohort"
        description="Request to join another public cohort. An admin reviews every application."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle as="h2">New application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {catalogError ? (
            <Alert variant="danger">Could not load open programmes. Try again shortly.</Alert>
          ) : null}
          {!catalogLoading ? (
            <CatalogPicker fellowships={fellowships} value={selection} onChange={setSelection} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading open programmes…</p>
          )}

          {submit.error ? (
            <Alert variant="danger">
              {submit.error instanceof ApiError
                ? submit.error.message
                : 'Could not submit your application. Try again.'}
            </Alert>
          ) : null}
          {submit.isSuccess ? (
            <Alert variant="success">Application submitted — check back for a decision.</Alert>
          ) : null}

          <Button
            loading={submit.isPending}
            disabled={!selection.cohortId}
            onClick={() =>
              submit.mutate({
                cohortId: selection.cohortId as string,
                requestedLearningTrackId: selection.requestedLearningTrackId,
              })
            }
          >
            Submit application
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle as="h2">Your applications</CardTitle>
        </CardHeader>
        <CardContent>
          {applicationsLoading ? (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : !applications?.items.length ? (
            <EmptyState title="No applications yet" />
          ) : (
            <ul className="space-y-3">
              {applications.items.map((application) => (
                <li
                  key={application.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="text-foreground">
                      {new Date(application.createdAt).toLocaleDateString()}
                    </p>
                    {application.rejectionReason ? (
                      <p className="text-muted-foreground">{application.rejectionReason}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>
                    {application.status === 'pending' ? (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setWithdrawing({ id: application.id, version: application.version })
                        }
                      >
                        Withdraw
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        onConfirm={async () => {
          if (!withdrawing) return;
          try {
            await withdraw.mutateAsync(withdrawing);
            setWithdrawing(null);
          } catch {
            // surfaced above via withdraw.error
          }
        }}
        loading={withdraw.isPending}
        title="Withdraw this application?"
        description="You can apply again later if you change your mind."
        confirmLabel="Withdraw"
      />
    </div>
  );
}
