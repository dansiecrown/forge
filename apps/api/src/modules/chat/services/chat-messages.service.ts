import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { ChatAccessService, type FellowshipChatAuthorization } from './chat-access.service';
import { RedisEventsService } from './redis-events.service';
import { ChatChannelsRepository } from '../repositories/chat-channels.repository';
import { ChatMessagesRepository } from '../repositories/chat-messages.repository';
import { ChatReadStateRepository } from '../repositories/chat-read-state.repository';
import { toChatMessageEntity, type ChatMessageEntity } from '../entities/chat-message.entity';
import { NotificationsService } from '../../platform/services/notifications.service';

@Injectable()
export class ChatMessagesService {
  constructor(
    private readonly messagesRepository: ChatMessagesRepository,
    private readonly channelsRepository: ChatChannelsRepository,
    private readonly readStateRepository: ChatReadStateRepository,
    private readonly accessService: ChatAccessService,
    private readonly auditLog: AuditLogService,
    private readonly events: RedisEventsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Resolves the channel, then authorizes against *its* fellowship — the
   * one access check every read/write path in this service routes through,
   * mirroring `ChatChannelsService.requireManageAccess`'s shape but without
   * requiring manage capability. */
  private async requireChannelAccess(scope: TenantScope, userId: string, channelId: string) {
    const channel = await this.channelsRepository.findById(channelId);
    if (!channel || channel.organizationId !== scope.organizationId) {
      throw AppException.notFound('Channel not found.');
    }
    const authorization = await this.accessService.authorize(scope, userId, channel.fellowshipId);
    if (!authorization.allowed) {
      throw AppException.notFound('Channel not found.');
    }
    if (channel.isPrivate && !authorization.canManageChannels) {
      const isMember = await this.channelsRepository.isMember(channel.id, userId);
      if (!isMember) {
        throw AppException.notFound('Channel not found.');
      }
    }
    return { channel, authorization };
  }

  async list(
    scope: TenantScope,
    userId: string,
    channelId: string,
    options: { cursor?: string; limit?: string },
  ): Promise<CollectionResult<ChatMessageEntity>> {
    await this.requireChannelAccess(scope, userId, channelId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.messagesRepository.list(channelId, {
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toChatMessageEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async create(
    scope: TenantScope,
    userId: string,
    channelId: string,
    input: { content: string; replyToMessageId?: string },
  ): Promise<ChatMessageEntity> {
    const { channel } = await this.requireChannelAccess(scope, userId, channelId);
    if (channel.archivedAt) {
      throw AppException.conflict('CHANNEL_ARCHIVED', 'This channel is archived.');
    }
    if (input.replyToMessageId) {
      const parent = await this.messagesRepository.findById(input.replyToMessageId);
      if (!parent || parent.channelId !== channelId) {
        throw AppException.validation([
          {
            field: 'replyToMessageId',
            code: 'INVALID_PARENT',
            message: 'The message being replied to is not in this channel.',
          },
        ]);
      }
    }

    const message = await this.messagesRepository.create({
      channelId,
      authorId: userId,
      content: input.content,
      replyToMessageId: input.replyToMessageId,
    });
    const entity = toChatMessageEntity(message);

    await this.events.publish({
      event: 'chat.message.created',
      fellowshipId: channel.fellowshipId,
      channelId,
      payload: entity,
    });

    await this.notifyReply(scope, userId, message);
    return entity;
  }

  async update(
    scope: TenantScope,
    userId: string,
    messageId: string,
    content: string,
  ): Promise<ChatMessageEntity> {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw AppException.notFound('Message not found.');
    const { channel, authorization } = await this.requireChannelAccess(
      scope,
      userId,
      message.channelId,
    );
    this.assertCanEdit(message.authorId, userId, authorization);

    const updated = await this.messagesRepository.update(messageId, content);
    const entity = toChatMessageEntity(updated);
    await this.events.publish({
      event: 'chat.message.updated',
      fellowshipId: channel.fellowshipId,
      channelId: message.channelId,
      payload: entity,
    });
    return entity;
  }

  async remove(scope: TenantScope, userId: string, messageId: string): Promise<ChatMessageEntity> {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw AppException.notFound('Message not found.');
    const { channel, authorization } = await this.requireChannelAccess(
      scope,
      userId,
      message.channelId,
    );
    this.assertCanEdit(message.authorId, userId, authorization);

    const deleted = await this.messagesRepository.softDelete(messageId);
    const entity = toChatMessageEntity(deleted);
    await this.auditLog.record({
      action: 'chat_message.deleted',
      entityType: 'fellowship_chat_message',
      entityId: messageId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: userId,
      metadata: { moderated: message.authorId !== userId },
    });
    await this.events.publish({
      event: 'chat.message.deleted',
      fellowshipId: channel.fellowshipId,
      channelId: message.channelId,
      payload: entity,
    });
    return entity;
  }

  async addReaction(
    scope: TenantScope,
    userId: string,
    messageId: string,
    reaction: string,
  ): Promise<void> {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw AppException.notFound('Message not found.');
    const { channel } = await this.requireChannelAccess(scope, userId, message.channelId);

    await this.messagesRepository.addReaction(messageId, userId, reaction);
    const updated = await this.messagesRepository.findById(messageId);
    await this.events.publish({
      event: 'chat.reaction.updated',
      fellowshipId: channel.fellowshipId,
      channelId: message.channelId,
      payload: updated ? toChatMessageEntity(updated) : null,
    });
  }

  async removeReaction(
    scope: TenantScope,
    userId: string,
    messageId: string,
    reaction: string,
  ): Promise<void> {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw AppException.notFound('Message not found.');
    const { channel } = await this.requireChannelAccess(scope, userId, message.channelId);

    await this.messagesRepository.removeReaction(messageId, userId, reaction);
    const updated = await this.messagesRepository.findById(messageId);
    await this.events.publish({
      event: 'chat.reaction.updated',
      fellowshipId: channel.fellowshipId,
      channelId: message.channelId,
      payload: updated ? toChatMessageEntity(updated) : null,
    });
  }

  async markRead(
    scope: TenantScope,
    userId: string,
    channelId: string,
    lastReadMessageId?: string,
  ): Promise<void> {
    await this.requireChannelAccess(scope, userId, channelId);
    await this.readStateRepository.markRead(userId, channelId, lastReadMessageId);
  }

  /** Backs the frontend's unread channel indicators and in-thread unread
   * separator (Phase 8 V1: "unread state") — the read-state repository
   * already had the two queries this needs; only the controller route was
   * missing. A caller who has never opened this channel gets
   * `lastReadMessageId/lastReadAt: null` and every non-deleted message
   * counted as unread. */
  async getReadState(
    scope: TenantScope,
    userId: string,
    channelId: string,
  ): Promise<{ lastReadMessageId: string | null; lastReadAt: string | null; unreadCount: number }> {
    await this.requireChannelAccess(scope, userId, channelId);
    const state = await this.readStateRepository.getForUser(userId, channelId);
    const unreadCount = await this.readStateRepository.countUnread(
      channelId,
      state?.lastReadAt ?? null,
    );
    return {
      lastReadMessageId: state?.lastReadMessageId ?? null,
      lastReadAt: state?.lastReadAt.toISOString() ?? null,
      unreadCount,
    };
  }

  private assertCanEdit(
    authorId: string,
    callerId: string,
    authorization: FellowshipChatAuthorization,
  ): void {
    if (authorId === callerId) return;
    if (authorization.canModerate) return;
    throw AppException.forbidden();
  }

  /** Minimal, disclosed integration with the existing Notification model
   * (docs/adr/0014-fellowship-chat.md Decision 5) — a plain persisted row,
   * exactly like Announcement already creates, not a new delivery channel.
   * Only for a reply to the recipient's own message — never one row per
   * message in a channel. @mention notifications are deliberately not
   * implemented: User has no handle/username concept to match "@foo"
   * against (only `displayName`/`emailCanonical`), and inventing one just
   * for chat would be new architecture this task's own scope excludes. See
   * DEBT-034. */
  private async notifyReply(
    scope: TenantScope,
    actorUserId: string,
    message: { id: string; content: string; replyToMessageId: string | null },
  ): Promise<void> {
    if (!message.replyToMessageId) return;
    const parent = await this.messagesRepository.findById(message.replyToMessageId);
    if (!parent || parent.authorId === actorUserId) return;

    await this.notifications.notify({
      organizationId: scope.organizationId,
      recipientUserId: parent.authorId,
      actorUserId,
      type: 'chat.message.reply',
      title: 'New reply to your message',
      body: message.content.slice(0, 200),
      entityType: 'fellowship_chat_message',
      entityId: message.id,
    });
  }
}
