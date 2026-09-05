import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { AnnouncementTransitionDto, CreateAnnouncementDto } from '../dtos/announcement.dto';
import { AnnouncementsService } from '../services/announcements.service';

@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @RequirePermissions('announcement.read')
  list(
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.announcementsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      { cursor, limit },
    );
  }

  @Post()
  @RequirePermissions('announcement.manage')
  create(
    @Body() dto: CreateAnnouncementDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.announcementsService.create(
      { organizationId: requireOrganizationId(organizationId) },
      dto,
      user.id,
    );
  }

  @Post(':id/actions/publish')
  @RequirePermissions('announcement.manage')
  publish(
    @Param('id') id: string,
    @Body() dto: AnnouncementTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.announcementsService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post(':id/actions/archive')
  @RequirePermissions('announcement.manage')
  archive(
    @Param('id') id: string,
    @Body() dto: AnnouncementTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.announcementsService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
