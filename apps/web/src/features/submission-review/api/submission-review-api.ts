import type {
  ApproveSubmissionRequest,
  RequestRevisionRequest,
  SubmissionDetail,
  SubmissionReview,
  SubmissionReviewHistory,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function getSubmissionDetail(
  submissionId: string,
  organizationId?: string,
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(`/practical-task-submissions/${submissionId}`, {
    organizationId,
  });
}

export function getSubmissionReviewHistory(
  submissionId: string,
  organizationId?: string,
): Promise<SubmissionReviewHistory> {
  return apiRequest<SubmissionReviewHistory>(
    `/practical-task-submissions/${submissionId}/reviews`,
    { organizationId },
  );
}

export function approveSubmission(
  submissionId: string,
  body: ApproveSubmissionRequest,
  organizationId?: string,
): Promise<SubmissionReview> {
  return apiRequest<SubmissionReview>(
    `/practical-task-submissions/${submissionId}/actions/approve`,
    { method: 'POST', body, organizationId },
  );
}

export function requestRevision(
  submissionId: string,
  body: RequestRevisionRequest,
  organizationId?: string,
): Promise<SubmissionReview> {
  return apiRequest<SubmissionReview>(
    `/practical-task-submissions/${submissionId}/actions/request-revision`,
    { method: 'POST', body, organizationId },
  );
}
