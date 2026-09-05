import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AcademyActionReasonDto } from '../../organizations/dtos/academy.dto';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { AdminAcademiesService } from '../services/admin-academies.service';

@Controller('admin/academies')
export class AdminAcademiesController {
  constructor(private readonly adminAcademiesService: AdminAcademiesService) {}

  @Get(':academyId/stats')
  @RequirePermissions('reports.read')
  getStats(
    @Param('academyId') academyId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminAcademiesService.getStats(
      { organizationId: requireOrganizationId(organizationId) },
      academyId,
      user.id,
    );
  }

  @Get(':academyId/mentor-allocation')
  @RequirePermissions('reports.read')
  getMentorAllocation(
    @Param('academyId') academyId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminAcademiesService.getMentorAllocation(
      { organizationId: requireOrganizationId(organizationId) },
      academyId,
      user.id,
    );
  }

  @Post(':academyId/actions/archive')
  @RequirePermissions('academy.archive')
  archive(
    @Param('academyId') academyId: string,
    @Body() _dto: AcademyActionReasonDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminAcademiesService.archiveWithValidation(
      { organizationId: requireOrganizationId(organizationId) },
      academyId,
      user.id,
    );
  }
}
