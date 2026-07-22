import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { AppException } from '../../../shared/errors/app.exception';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { InviteUserDto } from '../dtos/users.dto';
import { UsersService } from '../services/users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly membershipsService: MembershipsService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  @Get()
  @RequirePermissions('user.read')
  list(@Query('cursor') cursor?: string, @Query('limit') limit?: string, @Query('q') q?: string) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    return this.usersService.list(cursor, parsedLimit, q);
  }

  @Get(':userId')
  async get(
    @Param('userId') userId: string,
    @CurrentUser() user: { id: string },
    @Headers('x-organization-id') organizationId?: string,
  ) {
    if (user.id !== userId) {
      if (
        !organizationId ||
        !(await this.permissionResolver.hasPermission(user.id, organizationId, 'user.read'))
      ) {
        throw AppException.forbidden();
      }
    }
    const target = await this.usersService.getById(userId);
    return {
      id: target.id,
      displayName: target.displayName,
      email: target.emailCanonical,
      status: target.status,
    };
  }

  @Post('invitations')
  @RequirePermissions('membership.invite')
  @HttpCode(HttpStatus.ACCEPTED)
  async invite(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: { id: string },
    @Headers('x-organization-id') organizationId: string,
  ) {
    const invited = await this.usersService.invite(dto.email, dto.displayName, user.id);
    await this.membershipsService.inviteIntoOrganization(
      { organizationId },
      invited.id,
      dto.roles ?? [],
      user.id,
    );
    return { invitationId: invited.id, status: 'sent' };
  }
}
