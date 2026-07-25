import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion } from '../../../shared/http/request-helpers';
import {
  CreateOrganizationDto,
  OrganizationActionReasonDto,
  UpdateOrganizationDto,
} from '../dtos/organization.dto';
import { OrganizationsService } from '../services/organizations.service';

/** Platform tenant administration. `GET/POST /organizations` and the
 * suspend/archive/restore actions are Super Admin-only (enforced inside
 * OrganizationsService, not just the permission-key guard — see its
 * `assertPlatformSuperAdmin`); `GET/PATCH /organizations/:orgId` are also
 * reachable by that organization's own ORG_ADMIN. */
@Controller()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('organizations')
  @RequirePermissions('organization.list')
  list(
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.organizationsService.list(user.id, { status, q, cursor, limit });
  }

  @Post('organizations')
  @RequirePermissions('organization.create')
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: { id: string }) {
    return this.organizationsService.create(user.id, dto);
  }

  @Get('organizations/:orgId')
  @RequirePermissions('organization.read')
  get(
    @Param('orgId') orgId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.get(user.id, organizationId, orgId);
  }

  @Patch('organizations/:orgId')
  @RequirePermissions('organization.update')
  update(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateOrganizationDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.update(
      user.id,
      organizationId,
      orgId,
      dto,
      requireIfMatchVersion(ifMatch),
    );
  }

  @Post('organizations/:orgId/actions/suspend')
  @RequirePermissions('organization.suspend')
  suspend(
    @Param('orgId') orgId: string,
    @Body() _dto: OrganizationActionReasonDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.suspend(user.id, orgId, user.id);
  }

  @Post('organizations/:orgId/actions/archive')
  @RequirePermissions('organization.archive')
  archive(
    @Param('orgId') orgId: string,
    @Body() _dto: OrganizationActionReasonDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.organizationsService.archive(user.id, orgId, user.id);
  }

  @Post('organizations/:orgId/actions/restore')
  @RequirePermissions('organization.restore')
  restore(@Param('orgId') orgId: string, @CurrentUser() user: { id: string }) {
    return this.organizationsService.restore(user.id, orgId, user.id);
  }
}
