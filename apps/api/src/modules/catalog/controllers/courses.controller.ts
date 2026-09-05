import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { CurriculumTransitionDto, ReorderDto } from '../dtos/curriculum-shared.dto';
import { CreateCourseDto, UpdateCourseDto } from '../dtos/course.dto';
import { CoursesService } from '../services/courses.service';

@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('learning-tracks/:trackId/courses')
  @RequirePermissions('curriculum.read')
  list(
    @Param('trackId') trackId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.list(
      { organizationId: requireOrganizationId(organizationId) },
      trackId,
      { status, q, cursor, limit },
    );
  }

  @Post('learning-tracks/:trackId/courses')
  @RequirePermissions('curriculum.create')
  create(
    @Param('trackId') trackId: string,
    @Body() dto: CreateCourseDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.coursesService.create(
      { organizationId: requireOrganizationId(organizationId) },
      trackId,
      dto,
      user.id,
    );
  }

  @Post('learning-tracks/:trackId/actions/reorder-courses')
  @RequirePermissions('curriculum.update')
  reorder(
    @Param('trackId') trackId: string,
    @Body() dto: ReorderDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.coursesService.reorder(
      { organizationId: requireOrganizationId(organizationId) },
      trackId,
      dto.items,
      user.id,
    );
  }

  @Get('courses/:id')
  @RequirePermissions('curriculum.read')
  get(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
    return this.coursesService.get({ organizationId: requireOrganizationId(organizationId) }, id);
  }

  @Patch('courses/:id')
  @RequirePermissions('curriculum.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.coursesService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('courses/:id/actions/publish')
  @RequirePermissions('curriculum.publish')
  publish(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.coursesService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('courses/:id/actions/archive')
  @RequirePermissions('curriculum.archive')
  archive(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.coursesService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('courses/:id/actions/restore')
  @RequirePermissions('curriculum.restore')
  restore(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.coursesService.restore(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
