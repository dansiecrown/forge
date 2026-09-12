import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ChatReadStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async markRead(userId: string, channelId: string, lastReadMessageId?: string): Promise<void> {
    await this.prisma.fellowshipChatReadState.upsert({
      where: { userId_channelId: { userId, channelId } },
      update: { lastReadMessageId, lastReadAt: new Date() },
      create: { userId, channelId, lastReadMessageId },
    });
  }

  /** This user's own read marker for one channel — `null` if they've never
   * read it (every message in the channel is then "unread"). */
  getForUser(
    userId: string,
    channelId: string,
  ): Promise<{ lastReadMessageId: string | null; lastReadAt: Date } | null> {
    return this.prisma.fellowshipChatReadState.findUnique({
      where: { userId_channelId: { userId, channelId } },
      select: { lastReadMessageId: true, lastReadAt: true },
    });
  }

  /** One query for every channel in a fellowship at once — used to compute
   * "unread since I last read this channel" without an N+1 per channel. */
  listForUser(
    userId: string,
    channelIds: string[],
  ): Promise<{ channelId: string; lastReadMessageId: string | null; lastReadAt: Date }[]> {
    return this.prisma.fellowshipChatReadState.findMany({
      where: { userId, channelId: { in: channelIds } },
      select: { channelId: true, lastReadMessageId: true, lastReadAt: true },
    });
  }

  /** Unread count is derived at read time (see the model's own doc comment
   * in schema.prisma) rather than a continuously-synchronized counter —
   * this is the one query that does the deriving, per channel. */
  countUnread(channelId: string, sinceCreatedAt: Date | null): Promise<number> {
    return this.prisma.fellowshipChatMessage.count({
      where: {
        channelId,
        deletedAt: null,
        ...(sinceCreatedAt ? { createdAt: { gt: sinceCreatedAt } } : {}),
      },
    });
  }
}
