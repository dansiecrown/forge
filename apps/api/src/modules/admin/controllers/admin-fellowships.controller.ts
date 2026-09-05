import { Body, Controller, Param, Post } from '@nestjs/common';
import { FellowshipTransitionDto } from '../../catalog/dtos/fellowship.dto';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { AdminFellowshipsService } from '../services/admin-fellowships.service';

@Controller('admin/fellowships')
export class AdminFellowshipsController {
  constructor(private readonly adminFellowshipsService: AdminFellowshipsService) {}

  @Post(':fellowshipId/actions/retire')
  @RequirePermissions('fellowship.retire')
  retire(
    @Param('fellowshipId') fellowshipId: string,
    @Body() dto: FellowshipTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminFellowshipsService.retireWithValidation(
      { organizationId: requireOrganizationId(organizationId) },
      fellowshipId,
      dto.version,
      user.id,
    );
  }
}
