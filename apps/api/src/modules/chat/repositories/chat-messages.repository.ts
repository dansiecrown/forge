import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { ChatMessageWithRelations } from './chat-message-relations';
import { MESSAGE_INCLUDE } from './chat-message-relations';

export interface CreateChatMessageData {
  channelId: string;
  authorId: string;
  content: string;
  replyToMessageId?: string;
}

@Injectable()
export class ChatMessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest-first cursor page — the client reverses it for display (load
   * the latest page, scroll up loads older pages via `cursor`). Never
   * returns a soft-deleted message's real content (see
   * `toChatMessageEntity`), but the row itself stays in the list so reply
   * threads and "message deleted" placeholders keep working. */
  async list(
    channelId: string,
    options: { cursor?: string; limit: number },
  ): Promise<{ rows: ChatMessageWithRelations[]; hasMore: boolean }> {
    const rows = await this.prisma.fellowshipChatMessage.findMany({
      where: { channelId },
      include: MESSAGE_INCLUDE,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(id: string): Promise<ChatMessageWithRelations | null> {
    return this.prisma.fellowshipChatMessage.findUnique({
      where: { id },
      include: MESSAGE_INCLUDE,
    });
  }

  create(data: CreateChatMessageData): Promise<ChatMessageWithRelations> {
    return this.prisma.fellowshipChatMessage.create({ data, include: MESSAGE_INCLUDE });
  }

  update(id: string, content: string): Promise<ChatMessageWithRelations> {
    return this.prisma.fellowshipChatMessage.update({
      where: { id },
      data: { content, editedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });
  }

  softDelete(id: string): Promise<ChatMessageWithRelations> {
    return this.prisma.fellowshipChatMessage.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });
  }

  /** Idempotent — a second identical reaction from the same user is a no-op
   * rather than an error, matching the partial-unique-index precedent
   * elsewhere in this codebase for "this action either already happened or
   * happens now" semantics. */
  async addReaction(messageId: string, userId: string, reaction: string): Promise<void> {
    try {
      await this.prisma.fellowshipChatMessageReaction.create({
        data: { messageId, userId, reaction },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  async removeReaction(messageId: string, userId: string, reaction: string): Promise<void> {
    await this.prisma.fellowshipChatMessageReaction.deleteMany({
      where: { messageId, userId, reaction },
    });
  }
}
