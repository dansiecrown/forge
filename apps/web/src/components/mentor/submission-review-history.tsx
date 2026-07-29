import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Timeline, type TimelineItem } from '@/components/portal/timeline';
import { useSubmissionReviewHistory } from '@/features/submission-review/hooks/use-submission-review';

/** Read-only review timeline — one component, two call sites: the mentor's
 * own Submission Review page, and embedded read-only into the student-side
 * `PracticalTaskPortalDetailPage` ("students must see review history").
 * Renders nothing while loading or when no review has happened yet, so it
 * never adds visual noise to a not-yet-reviewed submission. */
export function SubmissionReviewHistory({ submissionId }: { submissionId: string }) {
  const { data, isLoading } = useSubmissionReviewHistory(submissionId);

  if (isLoading || !data || data.reviews.length === 0) {
    return null;
  }

  const items: TimelineItem[] = data.reviews.map((review) => ({
    id: review.id,
    icon:
      review.status === 'approved' ? (
        <CheckCircle2 className="size-4" aria-hidden="true" />
      ) : (
        <RotateCcw className="size-4" aria-hidden="true" />
      ),
    title: review.status === 'approved' ? 'Approved' : 'Revision requested',
    meta: review.comment
      ? `${new Date(review.createdAt).toLocaleString()} — ${review.comment}`
      : new Date(review.createdAt).toLocaleString(),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Review history</CardTitle>
      </CardHeader>
      <CardContent>
        {data.isResubmission ? (
          <Badge tone="brand" className="mb-4">
            Resubmission
          </Badge>
        ) : null}
        <Timeline items={items} />
      </CardContent>
    </Card>
  );
}
