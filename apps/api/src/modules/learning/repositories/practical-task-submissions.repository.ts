import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  PracticalTaskSubmission,
  PracticalTaskSubmissionStatus,
  SubmissionReviewDecision,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

/** `approved` -> `status: completed`. `revision_requested` -> `status:
 * revision_requested` AND `submittedAt: null` — clearing `submittedAt` is
 * what makes `ProgressionService.buildContext`'s existing `submittedAt !==
 * null` gate check re-lock the module with zero duplicated logic. Symmetric
 * with `saveDraft`'s "editing reverts to draft" precedent below. Shared by
 * `PracticalTaskSubmissionsRepository.applyReviewDecision` and
 * `SubmissionReviewsRepository.recordDecision`'s transaction, so the mapping
 * exists exactly once — see docs/adr/0008-mentor-experience.md Decision 2. */
export function reviewDecisionUpdate(
  decision: SubmissionReviewDecision,
): Prisma.PracticalTaskSubmissionUpdateInput {
  return decision === 'approved'
    ? { status: 'completed' }
    : { status: 'revision_requested', submittedAt: null };
}

@Injectable()
export class PracticalTaskSubmissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOne(enrollmentId: string, practicalTaskId: string): Promise<PracticalTaskSubmission | null> {
    return this.prisma.practicalTaskSubmission.findUnique({
      where: { enrollmentId_practicalTaskId: { enrollmentId, practicalTaskId } },
    });
  }

  /** Looked up by the submission row's own id — used by Portfolio project
   * creation, which references a specific submission, not a task. */
  findById(id: string): Promise<PracticalTaskSubmission | null> {
    return this.prisma.practicalTaskSubmission.findUnique({ where: { id } });
  }

  /** Upsert, not append — no attempt history, since there is no grading to
   * version against (a resubmission simply overwrites). Editing an
   * already-`submitted` row reverts it to `draft`
   * (docs/adr/0007-student-experience.md) — the caller must explicitly call
   * `submit` again. */
  saveDraft(
    enrollmentId: string,
    practicalTaskId: string,
    data: { repositoryUrl?: string; liveDemoUrl?: string },
  ): Promise<PracticalTaskSubmission> {
    return this.prisma.practicalTaskSubmission.upsert({
      where: { enrollmentId_practicalTaskId: { enrollmentId, practicalTaskId } },
      update: { ...data, status: 'draft', submittedAt: null },
      create: { enrollmentId, practicalTaskId, ...data, status: 'draft' },
    });
  }

  /** Requires an existing draft row — a student can't submit content they
   * haven't saved. */
  submit(enrollmentId: string, practicalTaskId: string): Promise<PracticalTaskSubmission> {
    return this.prisma.practicalTaskSubmission.update({
      where: { enrollmentId_practicalTaskId: { enrollmentId, practicalTaskId } },
      data: { status: 'submitted', submittedAt: new Date() },
    });
  }

  listForEnrollment(enrollmentId: string): Promise<PracticalTaskSubmission[]> {
    return this.prisma.practicalTaskSubmission.findMany({ where: { enrollmentId } });
  }

  /** Mentor dashboard's pending-review queue — submissions across every
   * cohort a mentor is assigned to, optionally filtered by status. */
  listForCohorts(
    cohortIds: string[],
    options: { status?: PracticalTaskSubmissionStatus } = {},
  ): Promise<PracticalTaskSubmission[]> {
    return this.prisma.practicalTaskSubmission.findMany({
      where: {
        enrollment: { cohortId: { in: cohortIds } },
        ...(options.status ? { status: options.status } : {}),
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  applyReviewDecision(
    id: string,
    decision: SubmissionReviewDecision,
  ): Promise<PracticalTaskSubmission> {
    return this.prisma.practicalTaskSubmission.update({
      where: { id },
      data: reviewDecisionUpdate(decision),
    });
  }
}
