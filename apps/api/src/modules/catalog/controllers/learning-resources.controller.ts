import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { CurriculumTransitionDto, ReorderDto } from '../dtos/curriculum-shared.dto';
import {
  CreateLearningResourceDto,
  UpdateLearningResourceDto,
} from '../dtos/learning-resource.dto';
import { LearningResourcesService } from '../services/learning-resources.service';

@Controller()
export class LearningResourcesController {
  constructor(private readonly learningResourcesService: LearningResourcesService) {}

  @Get('weekly-modules/:moduleId/learning-resources')
  @RequirePermissions('curriculum.read')
  list(
    @Param('moduleId') moduleId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.learningResourcesService.list(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      { status, q, cursor, limit },
    );
  }

  @Post('weekly-modules/:moduleId/learning-resources')
  @RequirePermissions('curriculum.create')
  create(
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateLearningResourceDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningResourcesService.create(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      dto,
      user.id,
    );
  }

  @Post('weekly-modules/:moduleId/actions/reorder-resources')
  @RequirePermissions('curriculum.update')
  reorder(
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningResourcesService.reorder(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      dto.items,
      user.id,
    );
  }

  @Get('learning-resources/:id')
  @RequirePermissions('curriculum.read')
  get(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
    return this.learningResourcesService.get(
      { organizationId: requireOrganizationId(organizationId) },
      id,
    );
  }

  @Patch('learning-resources/:id')
  @RequirePermissions('curriculum.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLearningResourceDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningResourcesService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('learning-resources/:id/actions/publish')
  @RequirePermissions('curriculum.publish')
  publish(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningResourcesService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('learning-resources/:id/actions/archive')
  @RequirePermissions('curriculum.archive')
  archive(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningResourcesService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('learning-resources/:id/actions/restore')
  @RequirePermissions('curriculum.restore')
  restore(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.learningResourcesService.restore(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
