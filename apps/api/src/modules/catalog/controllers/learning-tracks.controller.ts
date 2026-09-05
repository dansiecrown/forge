import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { CurriculumTransitionDto, ReorderDto } from '../dtos/curriculum-shared.dto';
import { CreateLearningTrackDto, UpdateLearningTrackDto } from '../dtos/learning-track.dto';
import { LearningTracksService } from '../services/learning-tracks.service';

@Controller()
export class LearningTracksController {
  constructor(private readonly learningTracksService: LearningTracksService) {}

  @Get('fellowships/:fellowshipId/learning-tracks')
  @RequirePermissions('curriculum.read')
  list(
    @Param('fellowshipId') fellowshipId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.learningTracksService.list(
      { organizationId: requireOrganizationId(organizationId) },
      fellowshipId,
      { status, q, cursor, limit },
    );
  }

  @Post('fellowships/:fellowshipId/learning-tracks')
  @RequirePermissions('curriculum.create')
  create(
    @Param('fellowshipId') fellowshipId: string,
    @Body() dto: CreateLearningTrackDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningTracksService.create(
      { organizationId: requireOrganizationId(organizationId) },
      fellowshipId,
      dto,
      user.id,
    );
  }

  @Post('fellowships/:fellowshipId/actions/reorder-learning-tracks')
  @RequirePermissions('curriculum.update')
  reorder(
    @Param('fellowshipId') fellowshipId: string,
    @Body() dto: ReorderDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningTracksService.reorder(
      { organizationId: requireOrganizationId(organizationId) },
      fellowshipId,
      dto.items,
      user.id,
    );
  }

  @Get('learning-tracks/:id')
  @RequirePermissions('curriculum.read')
  get(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
    return this.learningTracksService.get(
      { organizationId: requireOrganizationId(organizationId) },
      id,
    );
  }

  @Patch('learning-tracks/:id')
  @RequirePermissions('curriculum.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLearningTrackDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningTracksService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('learning-tracks/:id/actions/publish')
  @RequirePermissions('curriculum.publish')
  publish(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningTracksService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('learning-tracks/:id/actions/archive')
  @RequirePermissions('curriculum.archive')
  archive(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningTracksService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('learning-tracks/:id/actions/restore')
  @RequirePermissions('curriculum.restore')
  restore(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningTracksService.restore(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
