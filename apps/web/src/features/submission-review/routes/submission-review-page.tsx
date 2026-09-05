import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { SubmissionReviewHistory } from '@/components/mentor/submission-review-history';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextareaField } from '@/components/textarea-field';
import { EmptyState } from '@/components/portal/empty-state';
import {
  useApproveSubmission,
  useRequestRevision,
  useSubmissionDetail,
} from '../hooks/use-submission-review';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  submitted: 'success',
  under_review: 'brand',
  revision_requested: 'warning',
  completed: 'success',
};

export function SubmissionReviewPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { data: submission, isLoading, error } = useSubmissionDetail(submissionId);
  const approve = useApproveSubmission(submissionId ?? '');
  const requestRevision = useRequestRevision(submissionId ?? '');
  const [comment, setComment] = useState('');

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !submission) {
    return <EmptyState title="We couldn't load this submission." />;
  }

  const canReview = submission.status === 'submitted';
  const actionError =
    approve.error instanceof ApiError
      ? approve.error.message
      : requestRevision.error instanceof ApiError
        ? requestRevision.error.message
        : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={submission.taskTitle}
        description={`${submission.studentDisplayName} · ${submission.cohortName}`}
        action={<Badge tone={STATUS_TONE[submission.status]}>{submission.status}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {submission.submittedAt ? (
            <p className="text-sm text-muted-foreground">
              Submitted {new Date(submission.submittedAt).toLocaleString()}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-4">
            {submission.repositoryUrl ? (
              <a
                href={submission.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
              >
                Repository <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
            {submission.liveDemoUrl ? (
              <a
                href={submission.liveDemoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
              >
                Live demo <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
            {!submission.repositoryUrl && !submission.liveDemoUrl ? (
              <p className="text-sm text-muted-foreground">No links provided.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {submissionId ? <SubmissionReviewHistory submissionId={submissionId} /> : null}

      {canReview ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Leave feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {actionError ? <Alert variant="danger">{actionError}</Alert> : null}
            <TextareaField
              label="Comment"
              name="comment"
              rows={4}
              placeholder="Required when requesting a revision, optional when approving."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                loading={requestRevision.isPending}
                disabled={!comment.trim()}
                onClick={() => requestRevision.mutate({ comment })}
              >
                Request revision
              </Button>
              <Button
                type="button"
                loading={approve.isPending}
                onClick={() => approve.mutate({ comment: comment.trim() || undefined })}
              >
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="success">
          This submission has already been reviewed
          {submission.status === 'revision_requested'
            ? ' — a revision was requested and the student has not yet resubmitted.'
            : '.'}
        </Alert>
      )}
    </div>
  );
}
