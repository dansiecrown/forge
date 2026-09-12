import type { Notification } from '@prisma/client';
import type { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationsService } from './notifications.service';

function fakeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    organizationId: 'org-1',
    recipientUserId: 'student-1',
    actorUserId: 'mentor-1',
    type: 'chat.message.reply',
    title: 'New reply to your message',
    body: 'Great catch on the edge case.',
    entityType: 'fellowship_chat_message',
    entityId: 'message-1',
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(notification: Notification | null) {
  const notificationsRepository = {
    findById: jest.fn(async () => notification),
    markRead: jest.fn(async () => ({ ...notification!, readAt: new Date() })),
    markUnread: jest.fn(async () => ({ ...notification!, readAt: null })),
    markAllRead: jest.fn(async () => ({ count: 3 })),
  } as unknown as NotificationsRepository;

  const service = new NotificationsService(notificationsRepository);
  return { service, notificationsRepository };
}

describe('NotificationsService — ownership and read-state actions', () => {
  it('rejects marking a notification read that belongs to someone else', async () => {
    const { service } = buildService(fakeNotification({ recipientUserId: 'someone-else' }));

    await expect(service.markRead('student-1', 'notif-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('rejects a notification id that does not exist', async () => {
    const { service } = buildService(null);

    await expect(service.markRead('student-1', 'notif-x')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('marks the caller’s own notification read', async () => {
    const { service, notificationsRepository } = buildService(fakeNotification());

    await service.markRead('student-1', 'notif-1');
    expect(notificationsRepository.markRead).toHaveBeenCalledWith('notif-1');
  });

  it('marks the caller’s own notification back to unread — the explicit, manual exception', async () => {
    const { service, notificationsRepository } = buildService(
      fakeNotification({ readAt: new Date() }),
    );

    await service.markUnread('student-1', 'notif-1');
    expect(notificationsRepository.markUnread).toHaveBeenCalledWith('notif-1');
  });

  it('rejects marking unread a notification that belongs to someone else', async () => {
    const { service } = buildService(fakeNotification({ recipientUserId: 'someone-else' }));

    await expect(service.markUnread('student-1', 'notif-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('marks every unread notification for the caller read in one bulk action', async () => {
    const { service, notificationsRepository } = buildService(fakeNotification());

    await service.markAllRead('student-1');
    expect(notificationsRepository.markAllRead).toHaveBeenCalledWith('student-1');
  });
});
