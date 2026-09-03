import { Body, Controller, Get, Headers, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { Public } from '../../../decorators/public.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion } from '../../../shared/http/request-helpers';
import { UpdateSystemSettingsDto } from '../dtos/system-settings.dto';
import { AdminSettingsService } from '../services/admin-settings.service';

@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  @RequirePermissions('platform.settings.manage')
  get(@CurrentUser() user: { id: string }) {
    return this.adminSettingsService.get(user.id);
  }

  @Patch()
  @RequirePermissions('platform.settings.manage')
  update(
    @Body() dto: UpdateSystemSettingsDto,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminSettingsService.update(user.id, dto, requireIfMatchVersion(ifMatch));
  }
}

@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get('branding')
  @Public()
  getBranding() {
    return this.adminSettingsService.getPublicBranding();
  }
}
