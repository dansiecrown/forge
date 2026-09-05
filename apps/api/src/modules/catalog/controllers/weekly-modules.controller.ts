import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { CurriculumTransitionDto } from '../dtos/curriculum-shared.dto';
import { CreateWeeklyModuleDto, UpdateWeeklyModuleDto } from '../dtos/weekly-module.dto';
import { WeeklyModulesService } from '../services/weekly-modules.service';

@Controller()
export class WeeklyModulesController {
  constructor(private readonly weeklyModulesService: WeeklyModulesService) {}

  @Get('courses/:courseId/weekly-modules')
  @RequirePermissions('curriculum.read')
  list(
    @Param('courseId') courseId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.weeklyModulesService.list(
      { organizationId: requireOrganizationId(organizationId) },
      courseId,
      { status, q, cursor, limit },
    );
  }

  @Post('courses/:courseId/weekly-modules')
  @RequirePermissions('curriculum.create')
  create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateWeeklyModuleDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.weeklyModulesService.create(
      { organizationId: requireOrganizationId(organizationId) },
      courseId,
      dto,
      user.id,
    );
  }

  @Get('weekly-modules/:id')
  @RequirePermissions('curriculum.read')
  get(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
    return this.weeklyModulesService.get(
      { organizationId: requireOrganizationId(organizationId) },
      id,
    );
  }

  @Patch('weekly-modules/:id')
  @RequirePermissions('curriculum.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWeeklyModuleDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.weeklyModulesService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('weekly-modules/:id/actions/publish')
  @RequirePermissions('curriculum.publish')
  publish(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.weeklyModulesService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('weekly-modules/:id/actions/archive')
  @RequirePermissions('curriculum.archive')
  archive(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.weeklyModulesService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('weekly-modules/:id/actions/restore')
  @RequirePermissions('curriculum.restore')
  restore(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.weeklyModulesService.restore(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
