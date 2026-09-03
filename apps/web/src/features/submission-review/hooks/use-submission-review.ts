import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApproveSubmissionRequest, RequestRevisionRequest } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  approveSubmission,
  getSubmissionDetail,
  getSubmissionReviewHistory,
  requestRevision,
} from '../api/submission-review-api';

export function useSubmissionDetail(submissionId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['submission-detail', submissionId, activeOrganizationId],
    queryFn: () => getSubmissionDetail(submissionId as string, activeOrganizationId),
    enabled: Boolean(submissionId) && Boolean(activeOrganizationId),
  });
}

export function useSubmissionReviewHistory(submissionId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['submission-reviews', submissionId, activeOrganizationId],
    queryFn: () => getSubmissionReviewHistory(submissionId as string, activeOrganizationId),
    enabled: Boolean(submissionId) && Boolean(activeOrganizationId),
  });
}

function useInvalidateAfterReview(submissionId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['submission-detail', submissionId] });
    void queryClient.invalidateQueries({ queryKey: ['submission-reviews', submissionId] });
    void queryClient.invalidateQueries({ queryKey: ['mentors'] });
  };
}

export function useApproveSubmission(submissionId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const invalidate = useInvalidateAfterReview(submissionId);
  return useMutation({
    mutationFn: (body: ApproveSubmissionRequest) =>
      approveSubmission(submissionId, body, activeOrganizationId),
    onSuccess: invalidate,
  });
}

export function useRequestRevision(submissionId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const invalidate = useInvalidateAfterReview(submissionId);
  return useMutation({
    mutationFn: (body: RequestRevisionRequest) =>
      requestRevision(submissionId, body, activeOrganizationId),
    onSuccess: invalidate,
  });
}
