import { Injectable } from '@nestjs/common';
import type { ChatChannelType, FellowshipChatChannel } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateChatChannelData {
  organizationId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  description?: string;
  type?: ChatChannelType;
  isPrivate?: boolean;
}

@Injectable()
export class ChatChannelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByFellowship(
    fellowshipId: string,
    includeArchived = false,
  ): Promise<FellowshipChatChannel[]> {
    return this.prisma.fellowshipChatChannel.findMany({
      where: { fellowshipId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findById(id: string): Promise<FellowshipChatChannel | null> {
    return this.prisma.fellowshipChatChannel.findUnique({ where: { id } });
  }

  findByFellowshipAndSlug(
    fellowshipId: string,
    slug: string,
  ): Promise<FellowshipChatChannel | null> {
    return this.prisma.fellowshipChatChannel.findFirst({
      where: { fellowshipId, slug, archivedAt: null },
    });
  }

  create(data: CreateChatChannelData): Promise<FellowshipChatChannel> {
    return this.prisma.fellowshipChatChannel.create({ data });
  }

  async update(
    id: string,
    data: { name?: string; description?: string | null },
    expectedVersion: number,
  ): Promise<FellowshipChatChannel> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.fellowshipChatChannel.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new ChatChannelVersionConflictError(current.version);
      }
      return tx.fellowshipChatChannel.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  async setArchived(
    id: string,
    archived: boolean,
    expectedVersion: number,
  ): Promise<FellowshipChatChannel> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.fellowshipChatChannel.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new ChatChannelVersionConflictError(current.version);
      }
      return tx.fellowshipChatChannel.update({
        where: { id },
        data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } },
      });
    });
  }

  isMember(channelId: string, userId: string): Promise<boolean> {
    return this.prisma.fellowshipChatChannelMember
      .findUnique({ where: { channelId_userId: { channelId, userId } } })
      .then((row) => row !== null);
  }
}

export class ChatChannelVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('This channel has been modified since it was last read.');
  }
}
