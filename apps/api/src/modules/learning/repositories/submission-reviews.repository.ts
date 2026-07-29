import { Injectable } from '@nestjs/common';
import type { SubmissionReview, SubmissionReviewDecision } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { reviewDecisionUpdate } from './practical-task-submissions.repository';

@Injectable()
export class SubmissionReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Append-only, oldest first — the full history a student or mentor sees,
   * including every past `revision_requested` round. */
  listForSubmission(submissionId: string): Promise<SubmissionReview[]> {
    return this.prisma.submissionReview.findMany({
      where: { practicalTaskSubmissionId: submissionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Inserts the review row and applies its status transition to the
   * submission in one transaction — see `reviewDecisionUpdate` for the gate
   * re-lock this drives. */
  recordDecision(
    scope: TenantScope,
    submissionId: string,
    reviewerMembershipId: string,
    decision: SubmissionReviewDecision,
    comment: string | undefined,
  ): Promise<SubmissionReview> {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.submissionReview.create({
        data: {
          organizationId: scope.organizationId,
          practicalTaskSubmissionId: submissionId,
          reviewerMembershipId,
          status: decision,
          comment,
        },
      });
      await tx.practicalTaskSubmission.update({
        where: { id: submissionId },
        data: reviewDecisionUpdate(decision),
      });
      return review;
    });
  }
}
