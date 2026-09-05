import { Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateNotificationInput {
  recipientUserId: string;
  organizationId?: string;
  actorUserId?: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  cursor?: string;
  limit: number;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateNotificationInput): Promise<Notification> {
    return this.prisma.notification.create({ data: input });
  }

  /** Fan-out for a resolved announcement audience — a synchronous loop over
   * `createMany`, no outbox/delivery-channel table. See
   * docs/adr/0009-administration-platform.md Decision 1. */
  createMany(inputs: CreateNotificationInput[]): Promise<{ count: number }> {
    if (inputs.length === 0) {
      return Promise.resolve({ count: 0 });
    }
    return this.prisma.notification.createMany({ data: inputs });
  }

  findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async listForRecipient(
    userId: string,
    options: ListNotificationsOptions,
  ): Promise<{ rows: Notification[]; hasMore: boolean }> {
    const rows = await this.prisma.notification.findMany({
      where: { recipientUserId: userId, ...(options.unreadOnly ? { readAt: null } : {}) },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  markRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
