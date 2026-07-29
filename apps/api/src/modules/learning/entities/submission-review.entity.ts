import type { SubmissionReview } from '@prisma/client';

export interface SubmissionReviewEntity {
  id: string;
  practicalTaskSubmissionId: string;
  reviewerMembershipId: string;
  status: string;
  comment: string | null;
  createdAt: Date;
}

export function toSubmissionReviewEntity(row: SubmissionReview): SubmissionReviewEntity {
  return {
    id: row.id,
    practicalTaskSubmissionId: row.practicalTaskSubmissionId,
    reviewerMembershipId: row.reviewerMembershipId,
    status: row.status,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}
