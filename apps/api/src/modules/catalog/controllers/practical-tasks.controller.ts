import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { CurriculumTransitionDto, ReorderDto } from '../dtos/curriculum-shared.dto';
import { CreatePracticalTaskDto, UpdatePracticalTaskDto } from '../dtos/practical-task.dto';
import { PracticalTasksService } from '../services/practical-tasks.service';

@Controller()
export class PracticalTasksController {
  constructor(private readonly practicalTasksService: PracticalTasksService) {}

  @Get('weekly-modules/:moduleId/practical-tasks')
  @RequirePermissions('curriculum.read')
  list(
    @Param('moduleId') moduleId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.practicalTasksService.list(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      { status, q, cursor, limit },
    );
  }

  @Post('weekly-modules/:moduleId/practical-tasks')
  @RequirePermissions('curriculum.create')
  create(
    @Param('moduleId') moduleId: string,
    @Body() dto: CreatePracticalTaskDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.practicalTasksService.create(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      dto,
      user.id,
    );
  }

  @Post('weekly-modules/:moduleId/actions/reorder-tasks')
  @RequirePermissions('curriculum.update')
  reorder(
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.practicalTasksService.reorder(
      { organizationId: requireOrganizationId(organizationId) },
      moduleId,
      dto.items,
      user.id,
    );
  }

  @Get('practical-tasks/:id')
  @RequirePermissions('curriculum.read')
  get(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
    return this.practicalTasksService.get(
      { organizationId: requireOrganizationId(organizationId) },
      id,
    );
  }

  @Patch('practical-tasks/:id')
  @RequirePermissions('curriculum.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePracticalTaskDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.practicalTasksService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('practical-tasks/:id/actions/publish')
  @RequirePermissions('curriculum.publish')
  publish(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.practicalTasksService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('practical-tasks/:id/actions/archive')
  @RequirePermissions('curriculum.archive')
  archive(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.practicalTasksService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('practical-tasks/:id/actions/restore')
  @RequirePermissions('curriculum.restore')
  restore(
    @Param('id') id: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.practicalTasksService.restore(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
