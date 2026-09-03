import { Controller, Get } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  /** With an active organization scope, this is the org-scoped dashboard
   * (satisfiable by `reports.read` alone). Without one, it's the
   * cross-organization platform view, additionally gated to SUPER_ADMIN
   * inside the service. */
  @Get()
  @RequirePermissions('reports.read')
  get(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    if (!organizationId) {
      return this.adminDashboardService.getPlatformDashboard(user.id);
    }
    return this.adminDashboardService.getOrganizationDashboard({ organizationId });
  }
}
