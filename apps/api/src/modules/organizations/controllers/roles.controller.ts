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
  get(@Param('roleId') roleId: string) {
    return this.rolesService.get(roleId);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('role.update')
  update(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.rolesService.updatePermissions(
      roleId,
      dto.permissionIds,
      dto.version,
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
