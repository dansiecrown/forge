import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { ApproveSubmissionDto, RequestRevisionDto } from '../dtos/submission-review.dto';
import { SubmissionReviewsService } from '../services/submission-reviews.service';

@Controller()
export class SubmissionReviewsController {
  constructor(private readonly submissionReviewsService: SubmissionReviewsService) {}

  @Post('practical-task-submissions/:id/actions/approve')
  @RequirePermissions('learning.review.manage')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveSubmissionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.submissionReviewsService.recordDecision(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      'approved',
      dto.comment,
    );
  }

  @Post('practical-task-submissions/:id/actions/request-revision')
  @RequirePermissions('learning.review.manage')
  requestRevision(
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.submissionReviewsService.recordDecision(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      'revision_requested',
      dto.comment,
    );
  }

  /** Permission-gated at `enrollment.progress.read` (held by both STUDENT
   * and MENTOR/admins already) — the service enforces the actual
   * per-resource check (self-owner or assigned mentor), matching how
   * `getProgress` already works. */
  @Get('practical-task-submissions/:id/reviews')
  @RequirePermissions('enrollment.progress.read')
  listHistory(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.submissionReviewsService.listHistory(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  /** Backs the Mentor Portal's Submission Review page, which must work as a
   * standalone deep link (`/mentor/submissions/:submissionId`) without any
   * prior navigation state — same dual-path authorization as `reviews`
   * above. */
  @Get('practical-task-submissions/:id')
  @RequirePermissions('enrollment.progress.read')
  getDetail(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.submissionReviewsService.getDetail(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }
}
