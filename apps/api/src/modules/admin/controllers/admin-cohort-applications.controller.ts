import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  BulkCohortApplicationActionDto,
  CohortApplicationTransitionDto,
} from '../dtos/cohort-application.dto';
import { CohortApplicationsService } from '../services/cohort-applications.service';

@Controller('admin/cohort-applications')
export class AdminCohortApplicationsController {
  constructor(private readonly cohortApplicationsService: CohortApplicationsService) {}

  @Get()
  @RequirePermissions('cohort.application.read')
  list(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
    @Query('fellowshipId') fellowshipId?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cohortApplicationsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      { status, fellowshipId, q, cursor, limit },
    );
  }

  @Get(':id')
  @RequirePermissions('cohort.application.read')
  get(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortApplicationsService.get(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Post(':id/actions/approve')
  @RequirePermissions('cohort.application.manage')
  approve(
    @Param('id') id: string,
    @Body() dto: CohortApplicationTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortApplicationsService.approve(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post(':id/actions/reject')
  @RequirePermissions('cohort.application.manage')
  reject(
    @Param('id') id: string,
    @Body() dto: CohortApplicationTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortApplicationsService.reject(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      dto.reason,
      user.id,
    );
  }

  @Post('actions/bulk-approve')
  @RequirePermissions('cohort.application.manage')
  bulkApprove(
    @Body() dto: BulkCohortApplicationActionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortApplicationsService.bulkApprove(
      { organizationId: requireOrganizationId(organizationId) },
      dto.items,
      user.id,
    );
  }

  @Post('actions/bulk-reject')
  @RequirePermissions('cohort.application.manage')
  bulkReject(
    @Body() dto: BulkCohortApplicationActionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortApplicationsService.bulkReject(
      { organizationId: requireOrganizationId(organizationId) },
      dto.items,
      dto.reason,
      user.id,
    );
  }
}
