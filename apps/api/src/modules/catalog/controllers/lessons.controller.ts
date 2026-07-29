import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { CurriculumTransitionDto, ReorderDto } from '../dtos/curriculum-shared.dto';
import { CreateLessonDto, UpdateLessonDto } from '../dtos/lesson.dto';
import { LessonsService } from '../services/lessons.service';

@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get('weekly-modules/:moduleId/lessons')
  @RequirePermissions('curriculum.read')
  list(
    @Param('moduleId') moduleId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.lessonsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      { status, q, cursor, limit },
    );
  }

  @Post('weekly-modules/:moduleId/lessons')
  @RequirePermissions('curriculum.create')
  create(
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateLessonDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.lessonsService.create(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      dto,
      user.id,
    );
  }

  @Post('weekly-modules/:moduleId/actions/reorder-lessons')
  @RequirePermissions('curriculum.update')
  reorder(
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.lessonsService.reorder(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      dto.items,
      user.id,
    );
  }

  @Get('lessons/:id')
  @RequirePermissions('curriculum.read')
  get(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
    return this.lessonsService.get({ organizationId: requireOrganizationId(organizationId) }, id);
  }

  @Patch('lessons/:id')
  @RequirePermissions('curriculum.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.lessonsService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('lessons/:id/actions/publish')
  @RequirePermissions('curriculum.publish')
  publish(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.lessonsService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('lessons/:id/actions/archive')
  @RequirePermissions('curriculum.archive')
  archive(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.lessonsService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('lessons/:id/actions/restore')
  @RequirePermissions('curriculum.restore')
  restore(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.lessonsService.restore(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
