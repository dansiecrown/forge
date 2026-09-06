import type { DirectConversation, DirectMessage, User } from '@prisma/client';

export interface DirectConversationEntity {
  id: string;
  organizationId: string;
  /** Resolved server-side — see docs/adr/0015-name-first-display.md. Never
   * the caller themselves, regardless of whether they're `user1` or
   * `user2` on the underlying row. */
  otherParticipant: { id: string; displayName: string; username: string | null };
  lastMessage: { content: string; createdAt: Date; authorId: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toDirectConversationEntity(
  row: DirectConversation & { user1: User; user2: User; messages: DirectMessage[] },
  callerId: string,
): DirectConversationEntity {
  const other = row.user1Id === callerId ? row.user2 : row.user1;
  const last = row.messages[0];
  return {
    id: row.id,
    organizationId: row.organizationId,
    otherParticipant: { id: other.id, displayName: other.displayName, username: other.username },
    lastMessage: last
      ? { content: last.content, createdAt: last.createdAt, authorId: last.authorId }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface DirectMessageEntity {
  id: string;
  conversationId: string;
  authorId: string;
  /** Resolved server-side — see docs/adr/0015-name-first-display.md. */
  authorDisplayName: string | null;
  content: string;
  createdAt: Date;
}

export function toDirectMessageEntity(
  row: DirectMessage,
  author?: { displayName: string } | null,
): DirectMessageEntity {
  return {
    id: row.id,
    conversationId: row.conversationId,
    authorId: row.authorId,
    authorDisplayName: author?.displayName ?? null,
    content: row.content,
    createdAt: row.createdAt,
  };
}
