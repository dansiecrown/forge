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
import { IdempotencyService } from '../../../shared/idempotency/idempotency.service';
import { parseLimit } from '../../../shared/pagination/collection-result';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { InviteUserDto } from '../dtos/users.dto';
import { UsersService } from '../services/users.service';

const INVITATIONS_ROUTE = 'POST /users/invitations';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly membershipsService: MembershipsService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get()
  @RequirePermissions('user.read')
  list(@Query('cursor') cursor?: string, @Query('limit') limit?: string, @Query('q') q?: string) {
    return this.usersService.list(cursor, parseLimit(limit), q);
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
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const requestHash = this.idempotencyService.hashRequest(dto);

    if (idempotencyKey) {
      const replay = await this.idempotencyService.checkReplay<{
        invitationId: string;
        status: string;
      }>(idempotencyKey, INVITATIONS_ROUTE, requestHash);
      if (replay.replayed) {
        return replay.body;
      }
    }

    const invited = await this.usersService.invite(dto.email, dto.displayName, user.id);
    await this.membershipsService.inviteIntoOrganization(
      { organizationId },
      invited.user.id,
      dto.roles ?? [],
      user.id,
    );
    const response = {
      invitationId: invited.user.id,
      status: invited.isNewUser ? 'sent' : 'added',
    };

    if (idempotencyKey) {
      await this.idempotencyService.record(
        idempotencyKey,
        INVITATIONS_ROUTE,
        requestHash,
        HttpStatus.ACCEPTED,
        response,
      );
    }

    return response;
  }
}
