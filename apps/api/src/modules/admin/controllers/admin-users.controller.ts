import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { UpdateAdminUserProfileDto, UpdateAdminUserRolesDto } from '../dtos/admin-user.dto';
import { CreateAdminUserDto } from '../dtos/create-admin-user.dto';
import { AdminUsersService } from '../services/admin-users.service';

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  /** Admin-set-password creation, alongside (not instead of) the older
   * email-only `POST /users/invitations` — same `membership.invite` guard,
   * since both are "who can add people to this organization" actions. See
   * docs/adr/0009-administration-platform.md's addendum. */
  @Post()
  @RequirePermissions('membership.invite')
  create(
    @Body() dto: CreateAdminUserDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminUsersService.create(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      dto,
    );
  }

  @Get()
  @RequirePermissions('user.read')
  list(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminUsersService.list(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      { q, role, cursor, limit },
    );
  }

  @Get(':userId')
  @RequirePermissions('user.read')
  get(
    @Param('userId') userId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminUsersService.get(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      user.id,
    );
  }

  @Patch(':userId/profile')
  @RequirePermissions('user.update')
  updateProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserProfileDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminUsersService.updateProfile(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      user.id,
      dto,
    );
  }

  @Patch(':userId/roles')
  @RequirePermissions('membership.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateRoles(
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserRolesDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.adminUsersService.updateRoles(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      user.id,
      dto.roleKeys,
    );
  }

  @Post(':userId/actions/suspend')
  @RequirePermissions('user.suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(
    @Param('userId') userId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.adminUsersService.suspend(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      user.id,
    );
  }

  @Post(':userId/actions/reactivate')
  @RequirePermissions('user.reactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivate(
    @Param('userId') userId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.adminUsersService.reactivate(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      user.id,
    );
  }

  @Post(':userId/actions/reset-mfa')
  @RequirePermissions('user.mfa.reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetMfa(
    @Param('userId') userId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.adminUsersService.resetMfa(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      user.id,
    );
  }

  @Post(':userId/actions/force-password-reset')
  @RequirePermissions('user.password.force_reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forcePasswordReset(
    @Param('userId') userId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.adminUsersService.forcePasswordReset(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      user.id,
    );
  }

  @Get(':userId/sessions')
  @RequirePermissions('user.sessions.manage')
  listSessions(
    @Param('userId') userId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminUsersService.listSessions(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      { cursor, limit },
      user.id,
    );
  }

  @Delete(':userId/sessions/:sessionId')
  @RequirePermissions('user.sessions.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.adminUsersService.revokeSession(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      sessionId,
      user.id,
    );
  }

  @Post(':userId/sessions/actions/revoke-all')
  @RequirePermissions('user.sessions.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAllSessions(
    @Param('userId') userId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.adminUsersService.revokeAllSessions(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      user.id,
    );
  }

  @Get(':userId/login-history')
  @RequirePermissions('audit.read')
  getLoginHistory(
    @Param('userId') userId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminUsersService.getLoginHistory(
      { organizationId: requireOrganizationId(organizationId) },
      userId,
      { cursor, limit },
      user.id,
    );
  }
}
