import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { MfaService } from '../services/mfa.service';
import { UpdateMeDto } from '../dtos/users.dto';
import { UsersService } from '../services/users.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly membershipsService: MembershipsService,
    private readonly mfaService: MfaService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  @Get()
  async getMe(@CurrentUser() user: { id: string }) {
    const current = await this.usersService.getById(user.id);
    const [memberships, mfaEnabled] = await Promise.all([
      this.membershipsService.listForUser(user.id),
      this.mfaService.isEnabled(user.id),
    ]);
    return {
      id: current.id,
      displayName: current.displayName,
      email: current.emailCanonical,
      status: current.status,
      timezone: current.timezone,
      locale: current.locale,
      emailVerified: Boolean(current.emailVerifiedAt),
      mfaEnabled,
      memberships: memberships.map((membership) => ({
        organizationId: membership.organizationId,
        status: membership.status,
        roles: membership.membershipRoles.map((membershipRole) => membershipRole.role.key),
      })),
    };
  }

  /** Resolves the caller's real permission set for a given organization,
   * reusing `PermissionResolverService` (the same resolver `PermissionsGuard`
   * uses server-side) — no duplicated frontend copy of the grant table that
   * could silently drift from what the backend actually enforces. Powers
   * the admin UI's nav/action-button visibility, so a role only sees
   * controls it can actually use. `isSuperAdmin: true` means "treat as
   * having every permission" — `permissionKeys` is intentionally empty in
   * that case, matching `PermissionResolverService.resolve`'s own shape. */
  @Get('permissions')
  async getMyPermissions(
    @CurrentUser() user: { id: string },
    @Query('organizationId') organizationId?: string,
  ) {
    if (!organizationId) {
      const isSuperAdmin = await this.permissionResolver.hasPlatformRole(user.id, 'SUPER_ADMIN');
      return { organizationId: null, permissionKeys: [], isSuperAdmin };
    }
    const resolved = await this.permissionResolver.resolve(user.id, organizationId);
    return {
      organizationId,
      permissionKeys: Array.from(resolved.permissionKeys),
      isSuperAdmin: resolved.isSuperAdmin,
    };
  }

  @Patch()
  async updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateMeDto) {
    const updated = await this.usersService.updateMe(user.id, dto);
    return {
      id: updated.id,
      displayName: updated.displayName,
      timezone: updated.timezone,
      locale: updated.locale,
    };
  }
}
