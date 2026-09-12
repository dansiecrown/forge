import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { CreateDirectMessageDto, StartDirectConversationDto } from '../dtos/direct-message.dto';
import { DirectMessagesService } from '../services/direct-messages.service';

/** Self-scoped throughout — same "give me my own data" shape as
 * `NotificationsController` and `GET /enrollments/me`; ownership is
 * enforced in the service (is the caller a participant of this
 * conversation), never by permission key. `chat.message.create` is reused
 * purely to satisfy `PermissionsGuard` (already granted to every non-
 * platform role — ORG_ADMIN, ACADEMY_ADMIN, MENTOR, STUDENT), matching the
 * established "reuse a broad existing permission for a self-service route"
 * convention. See docs/adr/0014-fellowship-chat.md's 2026-09-06 addendum. */
@Controller('me')
export class DirectMessagesController {
  constructor(private readonly directMessagesService: DirectMessagesService) {}

  @Get('people/search')
  @RequirePermissions('chat.message.create')
  searchPeople(
    @Query('q') q: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.directMessagesService.searchPeople(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      q ?? '',
    );
  }

  @Get('conversations')
  @RequirePermissions('chat.message.create')
  listConversations(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.directMessagesService.listConversations(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
    );
  }

  @Post('conversations')
  @RequirePermissions('chat.message.create')
  startConversation(
    @Body() dto: StartDirectConversationDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.directMessagesService.startOrGetConversation(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      dto.userId,
    );
  }

  @Get('conversations/:id/messages')
  @RequirePermissions('chat.message.create')
  listMessages(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.directMessagesService.listMessages(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      id,
      { cursor, limit },
    );
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('chat.message.create')
  sendMessage(
    @Param('id') id: string,
    @Body() dto: CreateDirectMessageDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.directMessagesService.sendMessage(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      id,
      dto.content,
    );
  }
}
