import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { AppException } from '../../../shared/errors/app.exception';
import { UpdateMembershipStatusDto } from '../dtos/membership.dto';
import { MembershipsService } from '../services/memberships.service';
import { PermissionResolverService } from '../services/permission-resolver.service';

@Controller()
export class MembershipsController {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  @Get('users/:userId/memberships')
  async listForUser(
    @Param('userId') userId: string,
    @CurrentUser() user: { id: string },
    @Headers('x-organization-id') organizationId?: string,
  ) {
    await this.assertSelfOrPermission(user.id, userId, organizationId, 'membership.manage');
    return this.membershipsService.listForUser(userId);
  }

  @Patch('users/:userId/status')
  @HttpCode(HttpStatus.OK)
  async updateStatusByUser(
    @Param('userId') userId: string,
    @Body() dto: UpdateMembershipStatusDto,
    @CurrentUser() user: { id: string },
    @Headers('x-organization-id') organizationId?: string,
  ) {
    const scope = this.requireOrganization(organizationId);
    await this.assertPermission(user.id, scope.organizationId, 'membership.manage');
    await this.membershipsService.updateStatusForUser(scope, userId, dto.status, user.id);
    return { status: dto.status };
  }

  @Patch('memberships/:membershipId')
  async updateStatusByMembership(
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipStatusDto,
    @CurrentUser() user: { id: string },
    @Headers('x-organization-id') organizationId?: string,
  ) {
    const scope = this.requireOrganization(organizationId);
    await this.assertPermission(user.id, scope.organizationId, 'membership.manage');
    await this.membershipsService.updateStatus(scope, membershipId, dto.status, user.id);
    return { id: membershipId, status: dto.status };
  }

  private requireOrganization(organizationId?: string) {
    if (!organizationId) {
      throw AppException.forbidden('An active organization is required for this action.');
    }
    return { organizationId };
  }

  private async assertPermission(
    userId: string,
    organizationId: string,
    permissionKey: string,
  ): Promise<void> {
    const allowed = await this.permissionResolver.hasPermission(
      userId,
      organizationId,
      permissionKey,
    );
    if (!allowed) {
      throw AppException.forbidden();
    }
  }

  private async assertSelfOrPermission(
    callerId: string,
    targetUserId: string,
    organizationId: string | undefined,
    permissionKey: string,
  ): Promise<void> {
    if (callerId === targetUserId) return;
    if (!organizationId) {
      throw AppException.forbidden();
    }
    await this.assertPermission(callerId, organizationId, permissionKey);
  }
}
