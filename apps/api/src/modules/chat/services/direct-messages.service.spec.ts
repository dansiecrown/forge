import type { DirectConversation, DirectMessage, User } from '@prisma/client';
import type { UsersService } from '../../identity/services/users.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { NotificationsService } from '../../platform/services/notifications.service';
import type {
  DirectConversationWithParticipants,
  DirectMessagesRepository,
} from '../repositories/direct-messages.repository';
import { DirectMessagesService } from './direct-messages.service';

const SCOPE = { organizationId: 'org-1' };

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-x',
    emailCanonical: 'x@example.com',
    username: null,
    displayName: 'User X',
    givenName: null,
    familyName: null,
    status: 'active',
    emailVerifiedAt: new Date(),
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function fakeConversation(overrides: Partial<DirectConversation> = {}): DirectConversation {
  return {
    id: 'conversation-1',
    organizationId: 'org-1',
    user1Id: 'student-1',
    user2Id: 'mentor-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeConversationWithParticipants(
  overrides: Partial<DirectConversation> = {},
): DirectConversationWithParticipants {
  const conversation = fakeConversation(overrides);
  return {
    ...conversation,
    user1: fakeUser({ id: conversation.user1Id, displayName: 'Student One' }),
    user2: fakeUser({ id: conversation.user2Id, displayName: 'Mentor One', username: 'mentor1' }),
    messages: [],
  };
}

function fakeMessage(overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    authorId: 'student-1',
    content: 'Hi there',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(options: {
  conversation?: DirectConversationWithParticipants | null;
  isOrgMember?: boolean;
}) {
  const repository: Partial<DirectMessagesRepository> = {
    findConversation: jest.fn(async () => options.conversation ?? null),
    createConversation: jest.fn(async () => fakeConversation()),
    findConversationById: jest.fn(async () => options.conversation ?? null),
    listForUser: jest.fn(async () => (options.conversation ? [options.conversation] : [])),
    listMessages: jest.fn(async () => ({ rows: [], hasMore: false })),
    createMessage: jest.fn(async () => fakeMessage()),
  };
  const membershipsService = {
    hasActiveMembership: jest.fn(async () => options.isOrgMember ?? true),
    searchActiveMembers: jest.fn(async () => []),
  } as unknown as MembershipsService;
  const usersService = {
    listByIds: jest.fn(async (ids: string[]) => ids.map((id) => fakeUser({ id }))),
  } as unknown as UsersService;
  const notifications = {
    notify: jest.fn(async () => undefined),
  } as unknown as NotificationsService;

  const service = new DirectMessagesService(
    repository as DirectMessagesRepository,
    membershipsService,
    usersService,
    notifications,
  );
  return { service, repository, membershipsService, notifications };
}

describe('DirectMessagesService.startOrGetConversation', () => {
  it('rejects messaging yourself', async () => {
    const { service } = buildService({});
    await expect(
      service.startOrGetConversation(SCOPE, 'student-1', 'student-1'),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects a target with no active membership in the caller’s own organization', async () => {
    const { service } = buildService({ isOrgMember: false });
    await expect(
      service.startOrGetConversation(SCOPE, 'student-1', 'stranger-1'),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });

  it('reuses an existing conversation rather than creating a duplicate', async () => {
    const { service, repository } = buildService({
      conversation: fakeConversationWithParticipants(),
    });
    const result = await service.startOrGetConversation(SCOPE, 'student-1', 'mentor-1');
    expect(repository.createConversation).not.toHaveBeenCalled();
    expect(result.otherParticipant.id).toBe('mentor-1');
  });

  it('creates a new conversation when none exists yet', async () => {
    const { service, repository } = buildService({ conversation: null });
    (repository.listForUser as jest.Mock).mockImplementationOnce(async () => [
      fakeConversationWithParticipants(),
    ]);
    await service.startOrGetConversation(SCOPE, 'student-1', 'mentor-1');
    expect(repository.createConversation).toHaveBeenCalledWith('org-1', 'student-1', 'mentor-1');
  });
});

describe('DirectMessagesService — participant-only access', () => {
  it('rejects listing messages for a conversation the caller is not part of', async () => {
    const { service } = buildService({
      conversation: fakeConversationWithParticipants({ user1Id: 'a', user2Id: 'b' }),
    });
    await expect(
      service.listMessages(SCOPE, 'stranger-1', 'conversation-1', {}),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });

  it('rejects sending a message to a conversation the caller is not part of', async () => {
    const { service } = buildService({
      conversation: fakeConversationWithParticipants({ user1Id: 'a', user2Id: 'b' }),
    });
    await expect(
      service.sendMessage(SCOPE, 'stranger-1', 'conversation-1', 'hi'),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });

  it('allows either participant to send a message', async () => {
    const { service, repository } = buildService({
      conversation: fakeConversationWithParticipants({ user1Id: 'student-1', user2Id: 'mentor-1' }),
    });
    await service.sendMessage(SCOPE, 'mentor-1', 'conversation-1', 'hello back');
    expect(repository.createMessage).toHaveBeenCalledWith(
      'conversation-1',
      'mentor-1',
      'hello back',
    );
  });
});

describe('DirectMessagesService.sendMessage — notification', () => {
  it('notifies the other participant, not the sender', async () => {
    const { service, notifications } = buildService({
      conversation: fakeConversationWithParticipants({ user1Id: 'student-1', user2Id: 'mentor-1' }),
    });
    await service.sendMessage(SCOPE, 'student-1', 'conversation-1', 'hello');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: 'mentor-1', type: 'dm.message.received' }),
    );
  });
});
