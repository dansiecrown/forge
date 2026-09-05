import { Injectable } from '@nestjs/common';
import type { Announcement, AnnouncementScope, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateAnnouncementInput {
  organizationId?: string;
  academyId?: string;
  cohortId?: string;
  scope: AnnouncementScope;
  authorUserId: string;
  title: string;
  body: string;
}

export interface ListAnnouncementsOptions {
  organizationId?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAnnouncementInput): Promise<Announcement> {
    return this.prisma.announcement.create({ data: { ...input, status: 'draft' } });
  }

  findById(id: string): Promise<Announcement | null> {
    return this.prisma.announcement.findFirst({ where: { id, deletedAt: null } });
  }

  async list(
    options: ListAnnouncementsOptions,
  ): Promise<{ rows: Announcement[]; hasMore: boolean }> {
    const where: Prisma.AnnouncementWhereInput = {
      deletedAt: null,
      ...(options.organizationId
        ? { OR: [{ organizationId: options.organizationId }, { scope: 'platform' }] }
        : {}),
    };
    const rows = await this.prisma.announcement.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  publish(id: string, expectedVersion: number): Promise<Announcement> {
    return this.updateStatus(id, 'published', expectedVersion, { publishedAt: new Date() });
  }

  archive(id: string, expectedVersion: number): Promise<Announcement> {
    return this.updateStatus(id, 'archived', expectedVersion);
  }

  private async updateStatus(
    id: string,
    status: 'published' | 'archived',
    expectedVersion: number,
    extra: Record<string, unknown> = {},
  ): Promise<Announcement> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.announcement.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new AnnouncementVersionConflictError(current.version);
      }
      return tx.announcement.update({
        where: { id },
        data: { status, ...extra, version: { increment: 1 } },
      });
    });
  }

  /** Resolves the recipient user ids for a to-be-published announcement,
   * scoped by its own `scope`/`organizationId`/`academyId`/`cohortId`. */
  async resolveAudienceUserIds(announcement: Announcement): Promise<string[]> {
    if (announcement.scope === 'platform') {
      const users = await this.prisma.user.findMany({
        where: { status: 'active' },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (announcement.scope === 'cohort' && announcement.cohortId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { cohortId: announcement.cohortId, status: { in: ['active', 'paused'] } },
        select: { userId: true },
      });
      return [...new Set(enrollments.map((e) => e.userId))];
    }
    if (announcement.scope === 'academy' && announcement.academyId) {
      const memberships = await this.prisma.membership.findMany({
        where: { academyId: announcement.academyId, status: { in: ['active', 'invited'] } },
        select: { userId: true },
      });
      return [...new Set(memberships.map((m) => m.userId))];
    }
    if (announcement.organizationId) {
      const memberships = await this.prisma.membership.findMany({
        where: {
          organizationId: announcement.organizationId,
          status: { in: ['active', 'invited'] },
        },
        select: { userId: true },
      });
      return [...new Set(memberships.map((m) => m.userId))];
    }
    return [];
  }
}

export class AnnouncementVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Announcement has been modified since it was last read.');
  }
}
