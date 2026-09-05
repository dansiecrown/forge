import { Injectable } from '@nestjs/common';
import { AppException } from '../../../shared/errors/app.exception';
import {
  CollectionResult,
  parseLimit,
  type PageMeta,
} from '../../../shared/pagination/collection-result';
import {
  NotificationsRepository,
  type CreateNotificationInput,
} from '../repositories/notifications.repository';

/** A bare, unauthenticated persistence primitive — no permission check
 * inside it, same shape as `AuditLogService`. Lives in `PlatformModule` (the
 * root, reachable from every module in the chain) so that a future domain
 * event anywhere in `organizations`/`catalog`/`cohorts`/`learning` can call
 * `notify()` the same way they already call `AuditLogService.record()`,
 * without inverting the one-directional module chain. Only
 * `Announcement.publish()` calls this today — see
 * docs/adr/0009-administration-platform.md Decision 6. */
@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  notify(input: CreateNotificationInput): Promise<void> {
    return this.notificationsRepository.create(input).then(() => undefined);
  }

  notifyMany(inputs: CreateNotificationInput[]): Promise<void> {
    return this.notificationsRepository.createMany(inputs).then(() => undefined);
  }

  async listForRecipient(
    userId: string,
    options: { unreadOnly?: boolean; cursor?: string; limit?: string },
  ) {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.notificationsRepository.listForRecipient(userId, {
      unreadOnly: options.unreadOnly,
      cursor: options.cursor,
      limit,
    });
    const page: PageMeta = {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    };
    return new CollectionResult(rows, page);
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification || notification.recipientUserId !== userId) {
      throw AppException.notFound('Notification not found.');
    }
    await this.notificationsRepository.markRead(notificationId);
  }
}
