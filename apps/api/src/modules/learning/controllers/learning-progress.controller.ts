import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  RecordLessonCompletionDto,
  RecordResourceAcknowledgmentDto,
  SaveTaskSubmissionDraftDto,
  SubmitTaskDto,
} from '../dtos/learning-progress.dto';
import { DeadlineService } from '../services/deadline.service';
import { ProgressionService } from '../services/progression.service';

@Controller()
export class LearningProgressController {
  constructor(
    private readonly progressionService: ProgressionService,
    private readonly deadlineService: DeadlineService,
  ) {}

  @Post('lessons/:id/actions/complete')
  @RequirePermissions('learning.progress.record')
  @HttpCode(HttpStatus.NO_CONTENT)
  async completeLesson(
    @Param('id') id: string,
    @Body() dto: RecordLessonCompletionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.progressionService.completeLesson(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.enrollmentId,
      user.id,
    );
  }

  @Post('learning-resources/:id/actions/acknowledge')
  @RequirePermissions('learning.progress.record')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acknowledgeResource(
    @Param('id') id: string,
    @Body() dto: RecordResourceAcknowledgmentDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.progressionService.acknowledgeResource(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.enrollmentId,
      user.id,
    );
  }

  @Post('practical-tasks/:id/actions/save-draft')
  @RequirePermissions('learning.progress.record')
  @HttpCode(HttpStatus.NO_CONTENT)
  async saveTaskSubmissionDraft(
    @Param('id') id: string,
    @Body() dto: SaveTaskSubmissionDraftDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.progressionService.saveTaskSubmissionDraft(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.enrollmentId,
      user.id,
      { repositoryUrl: dto.repositoryUrl, liveDemoUrl: dto.liveDemoUrl },
    );
  }

  @Post('practical-tasks/:id/actions/submit')
  @RequirePermissions('learning.progress.record')
  @HttpCode(HttpStatus.NO_CONTENT)
  async submitTask(
    @Param('id') id: string,
    @Body() dto: SubmitTaskDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    const scope = { organizationId: requireOrganizationId(organizationId) };
    const dueDate = await this.deadlineService.computeDueDateForTask(
      scope,
      dto.enrollmentId,
      user.id,
      id,
    );
    await this.progressionService.submitTask(scope, id, dto.enrollmentId, user.id, dueDate);
  }

  @Get('enrollments/:id/progress')
  @RequirePermissions('enrollment.progress.read')
  getProgress(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.progressionService.getProgress(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }
}
