// Hand-authored request/response contracts for the Mentor submission-review
// endpoints (Milestone 6 — Mentor Experience). The lifecycle
// (Draft/Submitted/Revision Requested/Resubmitted/Approved) maps onto the
// existing PracticalTaskSubmissionStatus enum — "Resubmitted" is derived,
// not stored. See docs/adr/0008-mentor-experience.md Decision 2.

export interface SubmissionReview {
  id: string;
  practicalTaskSubmissionId: string;
  reviewerMembershipId: string;
  status: 'revision_requested' | 'approved';
  comment: string | null;
  createdAt: string;
}

export interface SubmissionReviewHistory {
  reviews: SubmissionReview[];
  isResubmission: boolean;
}

export interface ApproveSubmissionRequest {
  comment?: string;
}

export interface RequestRevisionRequest {
  comment: string;
}

/** Backs the Mentor Portal's Submission Review page, which must work as a
 * standalone deep link without prior navigation state. */
export interface SubmissionDetail {
  id: string;
  enrollmentId: string;
  practicalTaskId: string;
  taskTitle: string;
  studentDisplayName: string;
  cohortId: string;
  cohortName: string;
  status: string;
  repositoryUrl: string | null;
  liveDemoUrl: string | null;
  submittedAt: string | null;
}
