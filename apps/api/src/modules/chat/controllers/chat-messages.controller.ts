import { Body, Controller, Delete, Get, Param, Post, Patch, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  AddChatReactionDto,
  CreateChatMessageDto,
  MarkChannelReadDto,
  UpdateChatMessageDto,
} from '../dtos/chat-message.dto';
import { ChatMessagesService } from '../services/chat-messages.service';

@Controller()
export class ChatMessagesController {
  constructor(private readonly messagesService: ChatMessagesService) {}

  @Get('chat/channels/:channelId/messages')
  @RequirePermissions('chat.channel.read')
  list(
    @Param('channelId') channelId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.list(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
      { cursor, limit },
    );
  }

  @Post('chat/channels/:channelId/messages')
  @RequirePermissions('chat.message.create')
  create(
    @Param('channelId') channelId: string,
    @Body() dto: CreateChatMessageDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.messagesService.create(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
      dto,
    );
  }

  @Patch('chat/messages/:messageId')
  @RequirePermissions('chat.message.create')
  update(
    @Param('messageId') messageId: string,
    @Body() dto: UpdateChatMessageDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.messagesService.update(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      messageId,
      dto.content,
    );
  }

  @Delete('chat/messages/:messageId')
  @RequirePermissions('chat.message.create')
  remove(
    @Param('messageId') messageId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.messagesService.remove(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      messageId,
    );
  }

  @Post('chat/messages/:messageId/reactions')
  @RequirePermissions('chat.reaction.manage')
  async addReaction(
    @Param('messageId') messageId: string,
    @Body() dto: AddChatReactionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.messagesService.addReaction(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      messageId,
      dto.reaction,
    );
  }

  @Delete('chat/messages/:messageId/reactions/:reaction')
  @RequirePermissions('chat.reaction.manage')
  async removeReaction(
    @Param('messageId') messageId: string,
    @Param('reaction') reaction: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.messagesService.removeReaction(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      messageId,
      reaction,
    );
  }

  @Get('chat/channels/:channelId/read')
  @RequirePermissions('chat.channel.read')
  getReadState(
    @Param('channelId') channelId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.messagesService.getReadState(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
    );
  }

  @Post('chat/channels/:channelId/read')
  @RequirePermissions('chat.channel.read')
  async markRead(
    @Param('channelId') channelId: string,
    @Body() dto: MarkChannelReadDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.messagesService.markRead(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      channelId,
      dto.lastReadMessageId,
    );
  }
}
