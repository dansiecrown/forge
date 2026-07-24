import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { AppException } from '../../../shared/errors/app.exception';
import { CreateRoleDto, UpdateRolePermissionsDto } from '../dtos/role.dto';
import { RolesService } from '../services/roles.service';

function requireOrganizationId(organizationId: string | undefined): string {
  if (!organizationId) {
    throw AppException.forbidden('An active organization is required for this action.');
  }
  return organizationId;
}

/** `If-Match` carries the caller's expected `version` for optimistic
 * concurrency, per docs/api-specification.md §2. */
function requireIfMatchVersion(ifMatch: string | undefined): number {
  const version = Number(ifMatch);
  if (!ifMatch || !Number.isInteger(version) || version < 1) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'INVALID_REQUEST',
      'A numeric If-Match header with the expected version is required.',
    );
  }
  return version;
}

@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @RequirePermissions('role.read')
  list(@ActiveOrganizationId() organizationId?: string) {
    return this.rolesService.list({ organizationId: requireOrganizationId(organizationId) });
  }

  @Post('roles')
  @RequirePermissions('role.create')
  create(
    @Body() dto: CreateRoleDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.rolesService.create(
      { organizationId: requireOrganizationId(organizationId) },
      dto,
      user.id,
    );
  }

  @Get('roles/:roleId')
  @RequirePermissions('role.read')
  get(@Param('roleId') roleId: string, @ActiveOrganizationId() organizationId?: string) {
    return this.rolesService.get(roleId, organizationId);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('role.update')
  update(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.rolesService.updatePermissions(
      roleId,
      dto.permissionIds,
      requireIfMatchVersion(ifMatch),
      organizationId,
      user.id,
    );
  }

  @Delete('roles/:roleId')
  @RequirePermissions('role.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retire(@Param('roleId') roleId: string, @CurrentUser() user: { id: string }) {
    await this.rolesService.retire(roleId, user.id);
  }
}
