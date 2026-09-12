import type { FellowshipChatMessage } from '@prisma/client';

export interface ChatMessageReactionEntity {
  reaction: string;
  userId: string;
}

export interface ChatMessageEntity {
  id: string;
  channelId: string;
  authorId: string;
  authorDisplayName: string | null;
  content: string;
  replyToMessageId: string | null;
  replyToPreview: { authorDisplayName: string; content: string } | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reactions: ChatMessageReactionEntity[];
}

/** The relation shapes `ChatMessagesRepository` loads via its own include —
 * optional here because a freshly-`create()`d row has none of them loaded
 * yet (the gateway/controller re-fetches for the broadcast payload in that
 * case), same degrade-gracefully convention as
 * `CohortApplicationEntity`/`toCohortApplicationEntity`. */
export interface ChatMessageRelations {
  author?: { displayName: string } | null;
  replyTo?: { content: string; author: { displayName: string } } | null;
  reactions?: { reaction: string; userId: string }[];
}

export function toChatMessageEntity(
  row: FellowshipChatMessage & ChatMessageRelations,
): ChatMessageEntity {
  return {
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    authorDisplayName: row.author?.displayName ?? null,
    // A deleted message keeps its row (soft delete, for reply/thread
    // integrity) but never serves its own content back out.
    content: row.deletedAt ? '' : row.content,
    replyToMessageId: row.replyToMessageId,
    replyToPreview: row.replyTo
      ? { authorDisplayName: row.replyTo.author.displayName, content: row.replyTo.content }
      : null,
    editedAt: row.editedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reactions: row.reactions ?? [],
  };
}
