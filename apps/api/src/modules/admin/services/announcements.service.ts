import { Injectable } from '@nestjs/common';
import type { AnnouncementScope } from '@prisma/client';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { NotificationsService } from '../../platform/services/notifications.service';
import { AppException } from '../../../shared/errors/app.exception';
import {
  CollectionResult,
  parseLimit,
  type PageMeta,
} from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import {
  AnnouncementsRepository,
  AnnouncementVersionConflictError,
} from '../repositories/announcements.repository';
import { assertPlatformSuperAdmin } from '../support/assert-platform-super-admin';

export interface CreateAnnouncementInput {
  scope: AnnouncementScope;
  academyId?: string;
  cohortId?: string;
  title: string;
  body: string;
}

/** Direct synchronous `Notification` persistence on publish — no outbox, no
 * delivery channels, matching `AuditLogService`'s own "scoped-down kernel"
 * precedent. See docs/adr/0009-administration-platform.md Decision 1. */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(scope: TenantScope, input: CreateAnnouncementInput, actorUserId: string) {
    if (input.scope === 'platform') {
      await assertPlatformSuperAdmin(this.permissionResolver, actorUserId);
    }
    const announcement = await this.announcementsRepository.create({
      organizationId: input.scope === 'platform' ? undefined : scope.organizationId,
      academyId:
        input.scope === 'academy' || input.scope === 'cohort' ? input.academyId : undefined,
      cohortId: input.scope === 'cohort' ? input.cohortId : undefined,
      scope: input.scope,
      authorUserId: actorUserId,
      title: input.title,
      body: input.body,
    });
    await this.auditLog.record({
      action: 'announcement.created',
      entityType: 'announcement',
      entityId: announcement.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return announcement;
  }

  async list(scope: TenantScope, options: { cursor?: string; limit?: string }) {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.announcementsRepository.list({
      organizationId: scope.organizationId,
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

  async publish(scope: TenantScope, id: string, expectedVersion: number, actorUserId: string) {
    const announcement = await this.announcementsRepository.findById(id);
    if (!announcement) {
      throw AppException.notFound('Announcement not found.');
    }
    try {
      const published = await this.announcementsRepository.publish(id, expectedVersion);
      const recipientUserIds = await this.announcementsRepository.resolveAudienceUserIds(published);
      await this.notificationsService.notifyMany(
        recipientUserIds.map((recipientUserId) => ({
          recipientUserId,
          organizationId: scope.organizationId,
          actorUserId,
          type: 'announcement.published',
          title: published.title,
          body: published.body,
          entityType: 'announcement',
          entityId: published.id,
        })),
      );
      await this.auditLog.record({
        action: 'announcement.published',
        entityType: 'announcement',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
        metadata: { recipientCount: recipientUserIds.length },
      });
      return published;
    } catch (error) {
      if (error instanceof AnnouncementVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Announcement has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  async archive(scope: TenantScope, id: string, expectedVersion: number, actorUserId: string) {
    try {
      const archived = await this.announcementsRepository.archive(id, expectedVersion);
      await this.auditLog.record({
        action: 'announcement.archived',
        entityType: 'announcement',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return archived;
    } catch (error) {
      if (error instanceof AnnouncementVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Announcement has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }
}
