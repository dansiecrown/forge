import { Controller, Get, Param } from '@nestjs/common';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { AdminStatsRepository } from '../repositories/admin-stats.repository';

@Controller('admin/organizations')
export class AdminOrganizationsController {
  constructor(private readonly adminStatsRepository: AdminStatsRepository) {}

  @Get(':orgId/stats')
  @RequirePermissions('reports.read')
  getStats(@Param('orgId') orgId: string) {
    return this.adminStatsRepository.getOrganizationStats(orgId);
  }
}
