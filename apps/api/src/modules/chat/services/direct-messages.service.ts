import { Injectable } from '@nestjs/common';
import { UsersService } from '../../identity/services/users.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { NotificationsService } from '../../platform/services/notifications.service';
import { DirectMessagesRepository } from '../repositories/direct-messages.repository';
import {
  toDirectConversationEntity,
  toDirectMessageEntity,
  type DirectConversationEntity,
  type DirectMessageEntity,
} from '../entities/direct-message.entity';

/** User-to-user DMs — deliberately organization-scoped (never platform-wide,
 * even though `User`/`username` are global identities) and deliberately
 * minimal (no reactions, no reply-threading, no dedicated read-state table
 * — unread signaling reuses the Notification model instead). See
 * docs/adr/0014-fellowship-chat.md's 2026-09-06 addendum, formally
 * reversing that ADR's original "DMs out of scope" decision. */
@Injectable()
export class DirectMessagesService {
  constructor(
    private readonly repository: DirectMessagesRepository,
    private readonly membershipsService: MembershipsService,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  async listConversations(
    scope: TenantScope,
    callerId: string,
  ): Promise<DirectConversationEntity[]> {
    const rows = await this.repository.listForUser(scope.organizationId, callerId);
    return rows.map((row) => toDirectConversationEntity(row, callerId));
  }

  /** Starts a new conversation, or returns the existing one — the pair is
   * normalized (see the repository's `sortedPair`), so this is idempotent
   * regardless of who calls it first. Rejects DMing yourself, and rejects a
   * target with no active membership in the caller's own organization —
   * the tenant-scoping boundary a confirmed product decision drew
   * deliberately (usernames are globally unique, but that must never make
   * a stranger in an unrelated organization contactable). */
  async startOrGetConversation(
    scope: TenantScope,
    callerId: string,
    otherUserId: string,
  ): Promise<DirectConversationEntity> {
    if (otherUserId === callerId) {
      throw AppException.validation([
        { field: 'userId', code: 'CANNOT_MESSAGE_SELF', message: 'You cannot message yourself.' },
      ]);
    }
    const isOrgMember = await this.membershipsService.hasActiveMembership(scope, otherUserId);
    if (!isOrgMember) {
      throw AppException.notFound('This person is not a member of your organization.');
    }

    const conversation =
      (await this.repository.findConversation(scope.organizationId, callerId, otherUserId)) ??
      (await this.repository.createConversation(scope.organizationId, callerId, otherUserId));

    // `createConversation`/`findConversation` return the bare row — refetch
    // with the participant/last-message relations `toDirectConversationEntity`
    // needs, via the same query `listConversations` already uses.
    const withRelations = await this.repository.listForUser(scope.organizationId, callerId);
    const full = withRelations.find((row) => row.id === conversation.id);
    if (!full) {
      throw AppException.notFound('Conversation not found.');
    }
    return toDirectConversationEntity(full, callerId);
  }

  private async requireParticipant(scope: TenantScope, callerId: string, conversationId: string) {
    const conversation = await this.repository.findConversationById(conversationId);
    if (
      !conversation ||
      conversation.organizationId !== scope.organizationId ||
      (conversation.user1Id !== callerId && conversation.user2Id !== callerId)
    ) {
      throw AppException.notFound('Conversation not found.');
    }
    return conversation;
  }

  async listMessages(
    scope: TenantScope,
    callerId: string,
    conversationId: string,
    options: { cursor?: string; limit?: string },
  ): Promise<CollectionResult<DirectMessageEntity>> {
    await this.requireParticipant(scope, callerId, conversationId);
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.repository.listMessages(conversationId, {
      cursor: options.cursor,
      limit,
    });
    const authorIds = [...new Set(rows.map((r) => r.authorId))];
    const authors = await this.usersService.listByIds(authorIds);
    const byId = new Map(authors.map((a) => [a.id, a]));
    return new CollectionResult(
      rows.map((row) => toDirectMessageEntity(row, byId.get(row.authorId))).reverse(),
      {
        nextCursor: hasMore ? rows[rows.length - 1].id : null,
        previousCursor: options.cursor ?? null,
        limit,
        hasMore,
      },
    );
  }

  async sendMessage(
    scope: TenantScope,
    callerId: string,
    conversationId: string,
    content: string,
  ): Promise<DirectMessageEntity> {
    const conversation = await this.requireParticipant(scope, callerId, conversationId);
    const message = await this.repository.createMessage(conversationId, callerId, content);
    const [author] = await this.usersService.listByIds([callerId]);
    const entity = toDirectMessageEntity(message, author);

    const recipientId =
      conversation.user1Id === callerId ? conversation.user2Id : conversation.user1Id;
    await this.notifications.notify({
      organizationId: scope.organizationId,
      recipientUserId: recipientId,
      actorUserId: callerId,
      type: 'dm.message.received',
      title: `New message from ${author?.displayName ?? 'someone'}`,
      body: content.slice(0, 200),
      entityType: 'direct_conversation',
      entityId: conversationId,
    });

    return entity;
  }

  searchPeople(scope: TenantScope, callerId: string, query: string) {
    return this.membershipsService.searchActiveMembers(scope, query, callerId);
  }
}
