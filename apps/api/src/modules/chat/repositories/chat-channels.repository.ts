import { Injectable } from '@nestjs/common';
import type {
  ChatChannelType,
  FellowshipChatChannel,
  FellowshipChatChannelMember,
  User,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type ChatChannelMemberWithUser = FellowshipChatChannelMember & { user: User };

export interface CreateChatChannelData {
  organizationId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  description?: string;
  type?: ChatChannelType;
  isPrivate?: boolean;
  /** Set only when creating a `type: 'track'` channel — see
   * `findByCohortAndTrack`'s doc comment. */
  cohortId?: string;
  learningTrackId?: string;
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

  /** The one channel a Fellowship's Enrollment/CohortMentor membership sync
   * targets — every Fellowship always has exactly one, auto-created on
   * Fellowship creation (see docs/adr/0014-fellowship-chat.md Decision 4),
   * so `null` here means something upstream is broken, not a normal case. */
  findGeneralChannel(fellowshipId: string): Promise<FellowshipChatChannel | null> {
    return this.prisma.fellowshipChatChannel.findFirst({
      where: { fellowshipId, type: 'general' },
    });
  }

  /** Idempotent — upsert, not create, since a status transition that
   * bounces between active/paused/completed would otherwise hit the unique
   * constraint on every re-entry into "has access." */
  addMember(channelId: string, userId: string, addedByUserId?: string): Promise<void> {
    return this.prisma.fellowshipChatChannelMember
      .upsert({
        where: { channelId_userId: { channelId, userId } },
        create: { channelId, userId, addedByUserId },
        update: {},
      })
      .then(() => undefined);
  }

  /** Also idempotent — removing a membership that was never there (e.g. an
   * enrollment that goes straight from `invited` to `withdrawn`) is a
   * no-op, not an error. */
  removeMember(channelId: string, userId: string): Promise<void> {
    return this.prisma.fellowshipChatChannelMember
      .deleteMany({ where: { channelId, userId } })
      .then(() => undefined);
  }

  listMembers(channelId: string): Promise<ChatChannelMemberWithUser[]> {
    return this.prisma.fellowshipChatChannelMember.findMany({
      where: { channelId },
      include: { user: true },
      orderBy: { addedAt: 'asc' },
    });
  }

  /** Idempotency check for `ChatChannelsService.createTrackChannel()` — the
   * same Cohort should never end up with two channels for the same Track,
   * even if `CohortsService.setOfferedTracks()`'s creation call somehow
   * runs twice for the same newly-added track. */
  findByCohortAndTrack(
    cohortId: string,
    learningTrackId: string,
  ): Promise<FellowshipChatChannel | null> {
    return this.prisma.fellowshipChatChannel.findFirst({
      where: { cohortId, learningTrackId },
    });
  }

  /** `"<cohortId>:<learningTrackId>"` for every Enrollment `userId` holds in
   * `fellowshipId` that currently grants chat access (mirrors
   * `ChatAccessService.authorize()`'s own Student status set) — used to
   * decide which `type: 'track'` channels a Student may see. Fetched here,
   * not in `ChatAccessService`, to avoid that service needing to know about
   * Cohort/LearningTrack at all; this is purely a `list()`-time visibility
   * filter, never an access grant. */
  async listStudentTrackKeys(userId: string, fellowshipId: string): Promise<Set<string>> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, fellowshipId, status: { in: ['active', 'paused', 'completed'] } },
      select: { cohortId: true, currentLearningTrackId: true },
    });
    return new Set(
      enrollments
        .filter((enrollment) => enrollment.currentLearningTrackId)
        .map((enrollment) => `${enrollment.cohortId}:${enrollment.currentLearningTrackId}`),
    );
  }
}

export class ChatChannelVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('This channel has been modified since it was last read.');
  }
}
