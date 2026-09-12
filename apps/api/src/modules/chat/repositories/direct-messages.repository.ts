import { Injectable } from '@nestjs/common';
import type { DirectConversation, DirectMessage, User } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type DirectConversationWithParticipants = DirectConversation & {
  user1: User;
  user2: User;
  messages: DirectMessage[];
};

/** Always normalizes the pair so `(a, b)` and `(b, a)` resolve to the same
 * row — the unique constraint is on `(organizationId, user1Id, user2Id)`
 * specifically, so callers must never pass an unsorted pair through to a
 * `where` clause directly. */
function sortedPair(userAId: string, userBId: string): [string, string] {
  return userAId < userBId ? [userAId, userBId] : [userBId, userAId];
}

@Injectable()
export class DirectMessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConversation(
    organizationId: string,
    userAId: string,
    userBId: string,
  ): Promise<DirectConversation | null> {
    const [user1Id, user2Id] = sortedPair(userAId, userBId);
    return this.prisma.directConversation.findUnique({
      where: { organizationId_user1Id_user2Id: { organizationId, user1Id, user2Id } },
    });
  }

  createConversation(
    organizationId: string,
    userAId: string,
    userBId: string,
  ): Promise<DirectConversation> {
    const [user1Id, user2Id] = sortedPair(userAId, userBId);
    return this.prisma.directConversation.create({
      data: { organizationId, user1Id, user2Id },
    });
  }

  findConversationById(id: string): Promise<DirectConversation | null> {
    return this.prisma.directConversation.findUnique({ where: { id } });
  }

  /** One row per conversation, each carrying just its latest message (for
   * an inbox preview) — never the full history, which `listMessages` below
   * paginates separately. Sorted by `updatedAt` (bumped by every new
   * message in `createMessage`), so the most recently active conversation
   * always sorts first. */
  listForUser(
    organizationId: string,
    userId: string,
  ): Promise<DirectConversationWithParticipants[]> {
    return this.prisma.directConversation.findMany({
      where: { organizationId, OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: true,
        user2: true,
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listMessages(
    conversationId: string,
    options: { cursor?: string; limit: number },
  ): Promise<{ rows: DirectMessage[]; hasMore: boolean }> {
    const rows = await this.prisma.directMessage.findMany({
      where: { conversationId },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  /** Creates the message and bumps the conversation's `updatedAt` in one
   * transaction — the inbox's sort-by-recent key would otherwise silently
   * go stale (Prisma's `@updatedAt` only fires on an explicit `update()` of
   * that row, never as a side effect of creating a related row). Setting it
   * explicitly rather than passing an empty `data: {}` — confirmed live
   * that Prisma 6.19.3 silently skips the `@updatedAt` auto-touch when the
   * update payload has no other fields, so an empty update is a genuine
   * no-op here, not just a style choice. */
  async createMessage(conversationId: string, authorId: string, content: string) {
    const [message] = await this.prisma.$transaction([
      this.prisma.directMessage.create({ data: { conversationId, authorId, content } }),
      this.prisma.directConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return message;
  }
}
