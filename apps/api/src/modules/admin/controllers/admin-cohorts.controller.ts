import { Controller, Get, Param } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { AdminCohortsService } from '../services/admin-cohorts.service';

@Controller('admin/cohorts')
export class AdminCohortsController {
  constructor(private readonly adminCohortsService: AdminCohortsService) {}

  @Get(':id/overview')
  @RequirePermissions('reports.read')
  getOverview(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminCohortsService.getOverview(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Get(':id/progress-overview')
  @RequirePermissions('reports.read')
  getProgressOverview(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminCohortsService.getProgressOverview(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Get(':id/attendance-summary')
  @RequirePermissions('reports.read')
  getAttendanceSummary(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminCohortsService.getAttendanceSummary(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Get(':id/completion-summary')
  @RequirePermissions('reports.read')
  getCompletionSummary(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminCohortsService.getCompletionSummary(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }
}
