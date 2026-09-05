import type { FellowshipChatChannel } from '@prisma/client';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { NotificationsService } from '../../platform/services/notifications.service';
import type { ChatChannelsRepository } from '../repositories/chat-channels.repository';
import type { ChatMessagesRepository } from '../repositories/chat-messages.repository';
import type { ChatReadStateRepository } from '../repositories/chat-read-state.repository';
import type { ChatMessageWithRelations } from '../repositories/chat-message-relations';
import type { ChatAccessService, FellowshipChatAuthorization } from './chat-access.service';
import type { RedisEventsService } from './redis-events.service';
import { ChatMessagesService } from './chat-messages.service';

const SCOPE = { organizationId: 'org-1' };

function fakeChannel(overrides: Partial<FellowshipChatChannel> = {}): FellowshipChatChannel {
  return {
    id: 'channel-1',
    organizationId: 'org-1',
    fellowshipId: 'fellowship-1',
    name: 'general',
    slug: 'general',
    description: null,
    type: 'general',
    isPrivate: false,
    archivedAt: null,
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function fakeMessage(overrides: Partial<ChatMessageWithRelations> = {}): ChatMessageWithRelations {
  return {
    id: 'message-1',
    channelId: 'channel-1',
    authorId: 'author-1',
    content: 'hello',
    replyToMessageId: null,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    author: { displayName: 'Author One' },
    replyTo: null,
    reactions: [],
    ...overrides,
  } as ChatMessageWithRelations;
}

function authorization(
  overrides: Partial<FellowshipChatAuthorization> = {},
): FellowshipChatAuthorization {
  return {
    allowed: true,
    fellowship: { id: 'fellowship-1', organizationId: 'org-1', academyId: 'academy-1', title: 'F' },
    canManageChannels: false,
    canModerate: false,
    ...overrides,
  };
}

function buildService(overrides: {
  messagesRepository?: Partial<ChatMessagesRepository>;
  channelsRepository?: Partial<ChatChannelsRepository>;
  accessService?: Partial<ChatAccessService>;
}) {
  const messagesRepository: Partial<ChatMessagesRepository> = {
    list: jest.fn(async () => ({ rows: [], hasMore: false })),
    findById: jest.fn(async () => fakeMessage()),
    create: jest.fn(async () => fakeMessage()),
    update: jest.fn(async () => fakeMessage({ content: 'edited', editedAt: new Date() })),
    softDelete: jest.fn(async () => fakeMessage({ deletedAt: new Date() })),
    addReaction: jest.fn(async () => undefined),
    removeReaction: jest.fn(async () => undefined),
    ...overrides.messagesRepository,
  };
  const channelsRepository: Partial<ChatChannelsRepository> = {
    findById: jest.fn(async () => fakeChannel()),
    isMember: jest.fn(async () => false),
    ...overrides.channelsRepository,
  };
  const readStateRepository: Partial<ChatReadStateRepository> = {
    markRead: jest.fn(async () => undefined),
  };
  const accessService: Partial<ChatAccessService> = {
    authorize: jest.fn(async () => authorization()),
    ...overrides.accessService,
  };
  const auditLog: Partial<AuditLogService> = { record: jest.fn(async () => undefined) };
  const events: Partial<RedisEventsService> = { publish: jest.fn(async () => undefined) };
  const notifications: Partial<NotificationsService> = { notify: jest.fn(async () => undefined) };

  const service = new ChatMessagesService(
    messagesRepository as ChatMessagesRepository,
    channelsRepository as ChatChannelsRepository,
    readStateRepository as ChatReadStateRepository,
    accessService as ChatAccessService,
    auditLog as AuditLogService,
    events as RedisEventsService,
    notifications as NotificationsService,
  );
  return {
    service,
    messagesRepository,
    channelsRepository,
    readStateRepository,
    accessService,
    auditLog,
    events,
    notifications,
  };
}

describe('ChatMessagesService', () => {
  describe('access gating shared by every method', () => {
    it('rejects with not-found when the channel belongs to a different organization', async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () => fakeChannel({ organizationId: 'other' })),
        },
      });

      await expect(
        service.create(SCOPE, 'user-1', 'channel-1', { content: 'hi' }),
      ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    });

    it('rejects with not-found when the fellowship access check denies', async () => {
      const { service } = buildService({
        accessService: { authorize: jest.fn(async () => authorization({ allowed: false })) },
      });

      await expect(
        service.create(SCOPE, 'user-1', 'channel-1', { content: 'hi' }),
      ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    });

    it('rejects a non-member from a private channel even when fellowship access is allowed', async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () => fakeChannel({ isPrivate: true })),
          isMember: jest.fn(async () => false),
        },
      });

      await expect(
        service.create(SCOPE, 'user-1', 'channel-1', { content: 'hi' }),
      ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    });
  });

  describe('create', () => {
    it('rejects posting into an archived channel', async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () => fakeChannel({ archivedAt: new Date() })),
        },
      });

      await expect(
        service.create(SCOPE, 'user-1', 'channel-1', { content: 'hi' }),
      ).rejects.toMatchObject({ response: { code: 'CHANNEL_ARCHIVED' } });
    });

    it('rejects a reply pointing at a message from a different channel', async () => {
      const { service } = buildService({
        messagesRepository: {
          findById: jest.fn(async () =>
            fakeMessage({ id: 'parent-1', channelId: 'other-channel' }),
          ),
        },
      });

      await expect(
        service.create(SCOPE, 'user-1', 'channel-1', {
          content: 'hi',
          replyToMessageId: 'parent-1',
        }),
      ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    });

    it('creates the message and publishes chat.message.created', async () => {
      const { service, events } = buildService({});

      const result = await service.create(SCOPE, 'user-1', 'channel-1', { content: 'hi there' });

      expect(result.id).toBe('message-1');
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'chat.message.created', channelId: 'channel-1' }),
      );
    });

    it('notifies the parent author on a reply, but never the author replying to themselves', async () => {
      const { service, notifications, messagesRepository } = buildService({
        messagesRepository: {
          findById: jest.fn(async () => fakeMessage({ id: 'parent-1', authorId: 'parent-author' })),
          create: jest.fn(async () =>
            fakeMessage({ id: 'reply-1', authorId: 'user-1', replyToMessageId: 'parent-1' }),
          ),
        },
      });

      await service.create(SCOPE, 'user-1', 'channel-1', {
        content: 'reply text',
        replyToMessageId: 'parent-1',
      });

      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: 'parent-author', type: 'chat.message.reply' }),
      );
      jest.clearAllMocks();

      // Now simulate replying to your own message — findById used for both
      // the reply-target validation and the notifyReply lookup.
      messagesRepository.findById = jest.fn(async () =>
        fakeMessage({ id: 'parent-1', authorId: 'user-1' }),
      );
      await service.create(SCOPE, 'user-1', 'channel-1', {
        content: 'reply to self',
        replyToMessageId: 'parent-1',
      });
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe('update / remove authorization', () => {
    it('allows the original author to edit their own message', async () => {
      const { service } = buildService({
        messagesRepository: { findById: jest.fn(async () => fakeMessage({ authorId: 'user-1' })) },
      });

      await expect(
        service.update(SCOPE, 'user-1', 'message-1', 'edited content'),
      ).resolves.toMatchObject({ content: 'edited' });
    });

    it("rejects editing someone else's message without moderate capability", async () => {
      const { service } = buildService({
        messagesRepository: {
          findById: jest.fn(async () => fakeMessage({ authorId: 'other-user' })),
        },
        accessService: { authorize: jest.fn(async () => authorization({ canModerate: false })) },
      });

      await expect(service.update(SCOPE, 'user-1', 'message-1', 'x')).rejects.toMatchObject({
        response: { code: 'PERMISSION_DENIED' },
      });
    });

    it('allows a moderator to delete a message authored by someone else, and audit-logs it as moderated', async () => {
      const { service, auditLog, events } = buildService({
        messagesRepository: {
          findById: jest.fn(async () => fakeMessage({ authorId: 'other-user' })),
        },
        accessService: { authorize: jest.fn(async () => authorization({ canModerate: true })) },
      });

      await service.remove(SCOPE, 'moderator-1', 'message-1');

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { moderated: true } }),
      );
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'chat.message.deleted' }),
      );
    });

    it('rejects deletion of a message that does not exist', async () => {
      const { service } = buildService({
        messagesRepository: { findById: jest.fn(async () => null) },
      });

      await expect(service.remove(SCOPE, 'user-1', 'missing')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });
  });

  describe('reactions', () => {
    it('adds a reaction and republishes the updated message', async () => {
      const { service, messagesRepository, events } = buildService({});

      await service.addReaction(SCOPE, 'user-1', 'message-1', '👍');

      expect(messagesRepository.addReaction).toHaveBeenCalledWith('message-1', 'user-1', '👍');
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'chat.reaction.updated' }),
      );
    });

    it('removes a reaction and republishes the updated message', async () => {
      const { service, messagesRepository, events } = buildService({});

      await service.removeReaction(SCOPE, 'user-1', 'message-1', '👍');

      expect(messagesRepository.removeReaction).toHaveBeenCalledWith('message-1', 'user-1', '👍');
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'chat.reaction.updated' }),
      );
    });
  });

  describe('pagination', () => {
    it('marks hasMore and derives nextCursor from the last row when the repository reports more pages', async () => {
      const rows = [fakeMessage({ id: 'a' }), fakeMessage({ id: 'b' })];
      const { service } = buildService({
        messagesRepository: { list: jest.fn(async () => ({ rows, hasMore: true })) },
      });

      const result = await service.list(SCOPE, 'user-1', 'channel-1', {});
      expect(result.page.hasMore).toBe(true);
      expect(result.page.nextCursor).toBe('b');
    });

    it('reports no next cursor on the last page', async () => {
      const { service } = buildService({
        messagesRepository: {
          list: jest.fn(async () => ({ rows: [fakeMessage()], hasMore: false })),
        },
      });

      const result = await service.list(SCOPE, 'user-1', 'channel-1', {});
      expect(result.page.nextCursor).toBeNull();
    });
  });

  describe('read state', () => {
    it('requires channel access before recording a read marker', async () => {
      const { service } = buildService({
        accessService: { authorize: jest.fn(async () => authorization({ allowed: false })) },
      });

      await expect(
        service.markRead(SCOPE, 'user-1', 'channel-1', 'message-5'),
      ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    });

    it('delegates to the read-state repository once authorized', async () => {
      const { service, readStateRepository } = buildService({});

      await service.markRead(SCOPE, 'user-1', 'channel-1', 'message-5');

      expect(readStateRepository.markRead).toHaveBeenCalledWith('user-1', 'channel-1', 'message-5');
    });
  });
});
