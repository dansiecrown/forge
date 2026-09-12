import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  ChatChannelTransitionDto,
  CreateChatChannelDto,
  UpdateChatChannelDto,
} from '../dtos/chat-channel.dto';
import { ChatChannelsService } from '../services/chat-channels.service';

@Controller()
export class FellowshipChatChannelsController {
  constructor(private readonly channelsService: ChatChannelsService) {}

  @Get('fellowships/:fellowshipId/chat/channels')
  @RequirePermissions('chat.channel.read')
  list(
    @Param('fellowshipId') fellowshipId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.channelsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      fellowshipId,
      { includeArchived: includeArchived === 'true' },
    );
  }

  // `chat.channel.read` here, not `.manage` — a Mentor holds only the
  // former but may still create a channel in a Fellowship they're assigned
  // to (2026-09-12 addendum). This guard is deliberately coarse (blocks
  // anyone with no chat access at all); `ChatChannelsService.create()`'s
  // own `canCreateChannels` check does the real, Fellowship-specific
  // gating, same "coarse guard + precise service check" split this
  // codebase already uses for ownership-based routes elsewhere.
  @Post('fellowships/:fellowshipId/chat/channels')
  @RequirePermissions('chat.channel.read')
  create(
    @Param('fellowshipId') fellowshipId: string,
    @Body() dto: CreateChatChannelDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.channelsService.create(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      fellowshipId,
      dto,
    );
  }

  @Get('chat/channels/:channelId')
  @RequirePermissions('chat.channel.read')
  get(
    @Param('channelId') channelId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.channelsService.get(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
    );
  }

  @Get('chat/channels/:channelId/members')
  @RequirePermissions('chat.channel.read')
  listMembers(
    @Param('channelId') channelId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.channelsService.listMembers(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
    );
  }

  @Patch('chat/channels/:channelId')
  @RequirePermissions('chat.channel.manage')
  update(
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChatChannelDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.channelsService.update(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
      dto,
      requireIfMatchVersion(ifMatch),
    );
  }

  @Post('chat/channels/:channelId/actions/archive')
  @RequirePermissions('chat.channel.manage')
  archive(
    @Param('channelId') channelId: string,
    @Body() dto: ChatChannelTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.channelsService.setArchived(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
      true,
      dto.version,
    );
  }

  @Post('chat/channels/:channelId/actions/restore')
  @RequirePermissions('chat.channel.manage')
  restore(
    @Param('channelId') channelId: string,
    @Body() dto: ChatChannelTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.channelsService.setArchived(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
      false,
      dto.version,
    );
  }

  @Delete('chat/channels/:channelId')
  @RequirePermissions('chat.channel.manage')
  remove(
    @Param('channelId') channelId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    // DELETE archives rather than hard-deletes — matches the archive/restore
    // lifecycle Phase 3 asks for, and the app's own established convention
    // (Academy/Cohort/Fellowship) of never hard-deleting a resource with
    // history hanging off it (here: every message in the channel).
    return this.channelsService.setArchived(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
      true,
      requireIfMatchVersion(ifMatch),
    );
  }
}
