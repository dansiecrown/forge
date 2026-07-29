import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { MfaService } from '../services/mfa.service';
import { UpdateMeDto } from '../dtos/users.dto';
import { UsersService } from '../services/users.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly membershipsService: MembershipsService,
    private readonly mfaService: MfaService,
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
