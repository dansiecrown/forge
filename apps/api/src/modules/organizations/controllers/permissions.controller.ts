import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { PermissionsService } from '../services/permissions.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('permission.read')
  list(@Query('resource') resource?: string) {
    return this.permissionsService.list(resource);
  }
}
