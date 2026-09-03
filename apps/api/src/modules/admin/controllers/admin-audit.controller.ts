import { Controller, Get, Param, Query } from '@nestjs/common';
import type { AuditOutcome } from '@prisma/client';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { AdminAuditService } from '../services/admin-audit.service';

@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  search(
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('actorUserId') actorUserId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('outcome') outcome?: AuditOutcome,
    @Query('occurredFrom') occurredFrom?: string,
    @Query('occurredTo') occurredTo?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminAuditService.search(
      { organizationId: requireOrganizationId(organizationId) },
      {
        actorUserId,
        entityType,
        entityId,
        action,
        outcome,
        occurredFrom,
        occurredTo,
        cursor,
        limit,
      },
    );
  }

  @Get(':id')
  @RequirePermissions('audit.read')
  getById(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.adminAuditService.getById(
      organizationId ? { organizationId } : undefined,
      user.id,
      id,
    );
  }
}
