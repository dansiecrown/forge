import type { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { NotificationsService } from '../../platform/services/notifications.service';
import { AnnouncementsRepository } from '../repositories/announcements.repository';
import { AnnouncementsService } from './announcements.service';

const SCOPE = { organizationId: 'org-1' };

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

describe('AnnouncementsService.publish', () => {
  it('resolves the audience and fans out exactly one notification per recipient', async () => {
    const published = {
      id: 'announcement-1',
      title: 'Welcome',
      body: 'Hello cohort',
      version: 2,
      organizationId: 'org-1',
      scope: 'cohort',
      cohortId: 'cohort-1',
    };
    const repository: Partial<AnnouncementsRepository> = {
      findById: jest.fn(async () => ({ id: 'announcement-1', version: 1 }) as never),
      publish: jest.fn(async () => published as never),
      resolveAudienceUserIds: jest.fn(async () => ['user-1', 'user-2', 'user-3']),
    };
    const notificationsService: Partial<NotificationsService> = {
      notifyMany: jest.fn(async () => undefined),
    };
    const service = new AnnouncementsService(
      repository as AnnouncementsRepository,
      notificationsService as NotificationsService,
      {} as PermissionResolverService,
      fakeAuditLog(),
    );

    const result = await service.publish(SCOPE, 'announcement-1', 1, 'actor-1');

    expect(result).toBe(published);
    expect(notificationsService.notifyMany).toHaveBeenCalledTimes(1);
    const [inputs] = (notificationsService.notifyMany as jest.Mock).mock.calls[0];
    expect(inputs).toHaveLength(3);
    expect(inputs.every((n: { type: string }) => n.type === 'announcement.published')).toBe(true);
  });

  it('rejects publishing an announcement that no longer exists', async () => {
    const repository: Partial<AnnouncementsRepository> = {
      findById: jest.fn(async () => null),
    };
    const notificationsService: Partial<NotificationsService> = { notifyMany: jest.fn() };
    const service = new AnnouncementsService(
      repository as AnnouncementsRepository,
      notificationsService as NotificationsService,
      {} as PermissionResolverService,
      fakeAuditLog(),
    );

    await expect(service.publish(SCOPE, 'announcement-1', 1, 'actor-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    expect(notificationsService.notifyMany).not.toHaveBeenCalled();
  });
});
