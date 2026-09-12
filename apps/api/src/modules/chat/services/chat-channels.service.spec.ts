import type { FellowshipChatChannel } from '@prisma/client';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { ChatChannelsRepository } from '../repositories/chat-channels.repository';
import { ChatChannelVersionConflictError } from '../repositories/chat-channels.repository';
import type { ChatAccessService, FellowshipChatAuthorization } from './chat-access.service';
import type { RedisEventsService } from './redis-events.service';
import { ChatChannelsService } from './chat-channels.service';

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
    cohortId: null,
    learningTrackId: null,
    archivedAt: null,
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function authorization(
  overrides: Partial<FellowshipChatAuthorization> = {},
): FellowshipChatAuthorization {
  return {
    allowed: true,
    fellowship: { id: 'fellowship-1', organizationId: 'org-1', academyId: 'academy-1', title: 'F' },
    canManageChannels: false,
    canCreateChannels: false,
    canModerate: false,
    ...overrides,
  };
}

function buildService(overrides: {
  channelsRepository?: Partial<ChatChannelsRepository>;
  accessService?: Partial<ChatAccessService>;
}) {
  const channelsRepository: Partial<ChatChannelsRepository> = {
    listByFellowship: jest.fn(async () => []),
    findById: jest.fn(async () => fakeChannel()),
    findByFellowshipAndSlug: jest.fn(async () => null),
    create: jest.fn(async () => fakeChannel()),
    update: jest.fn(async () => fakeChannel({ version: 2 })),
    setArchived: jest.fn(async () => fakeChannel({ archivedAt: new Date() })),
    isMember: jest.fn(async () => false),
    listMembers: jest.fn(async () => []),
    findByCohortAndTrack: jest.fn(async () => null),
    listStudentTrackKeys: jest.fn(async () => new Set<string>()),
    ...overrides.channelsRepository,
  };
  const accessService: Partial<ChatAccessService> = {
    authorize: jest.fn(async () => authorization()),
    ...overrides.accessService,
  };
  const auditLog: Partial<AuditLogService> = { record: jest.fn(async () => undefined) };
  const events: Partial<RedisEventsService> = { publish: jest.fn(async () => undefined) };

  const service = new ChatChannelsService(
    channelsRepository as ChatChannelsRepository,
    accessService as ChatAccessService,
    auditLog as AuditLogService,
    events as RedisEventsService,
  );
  return { service, channelsRepository, accessService, auditLog, events };
}

describe('ChatChannelsService', () => {
  describe('list', () => {
    it('rejects as not-found when the caller has no access to the fellowship', async () => {
      const { service } = buildService({
        accessService: { authorize: jest.fn(async () => authorization({ allowed: false })) },
      });

      await expect(service.list(SCOPE, 'user-1', 'fellowship-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('hides a private channel from a non-member without manage capability', async () => {
      const privateChannel = fakeChannel({ id: 'channel-private', isPrivate: true });
      const { service, channelsRepository } = buildService({
        channelsRepository: {
          listByFellowship: jest.fn(async () => [privateChannel, fakeChannel()]),
          isMember: jest.fn(async () => false),
        },
      });

      const result = await service.list(SCOPE, 'user-1', 'fellowship-1');

      expect(result.channels.map((c) => c.id)).toEqual(['channel-1']);
      expect(channelsRepository.isMember).toHaveBeenCalledWith('channel-private', 'user-1');
    });

    it('includes a private channel for an actual member', async () => {
      const privateChannel = fakeChannel({ id: 'channel-private', isPrivate: true });
      const { service } = buildService({
        channelsRepository: {
          listByFellowship: jest.fn(async () => [privateChannel]),
          isMember: jest.fn(async () => true),
        },
      });

      const result = await service.list(SCOPE, 'user-1', 'fellowship-1');
      expect(result.channels.map((c) => c.id)).toEqual(['channel-private']);
    });

    it('includes every private channel for a caller who can manage channels', async () => {
      const privateChannel = fakeChannel({ id: 'channel-private', isPrivate: true });
      const { service, channelsRepository } = buildService({
        channelsRepository: { listByFellowship: jest.fn(async () => [privateChannel]) },
        accessService: {
          authorize: jest.fn(async () => authorization({ canManageChannels: true })),
        },
      });

      const result = await service.list(SCOPE, 'user-1', 'fellowship-1');
      expect(result.channels.map((c) => c.id)).toEqual(['channel-private']);
      expect(channelsRepository.isMember).not.toHaveBeenCalled();
    });

    it("surfaces the caller's own canManageChannels/canCreateChannels for this fellowship", async () => {
      const { service } = buildService({
        accessService: {
          authorize: jest.fn(async () =>
            authorization({ canManageChannels: false, canCreateChannels: true }),
          ),
        },
      });

      const result = await service.list(SCOPE, 'user-1', 'fellowship-1');
      expect(result.canManageChannels).toBe(false);
      expect(result.canCreateChannels).toBe(true);
    });

    it('never asks the repository for archived channels by default', async () => {
      const { service, channelsRepository } = buildService({});

      await service.list(SCOPE, 'user-1', 'fellowship-1');
      expect(channelsRepository.listByFellowship).toHaveBeenCalledWith('fellowship-1', false);
    });

    it('ignores includeArchived=true from a caller who cannot manage channels', async () => {
      const { service, channelsRepository } = buildService({});

      await service.list(SCOPE, 'user-1', 'fellowship-1', { includeArchived: true });
      expect(channelsRepository.listByFellowship).toHaveBeenCalledWith('fellowship-1', false);
    });

    it('honors includeArchived=true for a caller who can manage channels', async () => {
      const { service, channelsRepository } = buildService({
        accessService: {
          authorize: jest.fn(async () => authorization({ canManageChannels: true })),
        },
      });

      await service.list(SCOPE, 'user-1', 'fellowship-1', { includeArchived: true });
      expect(channelsRepository.listByFellowship).toHaveBeenCalledWith('fellowship-1', true);
    });

    it("hides a track channel from a Student not on that channel's own cohort+track", async () => {
      const trackChannel = fakeChannel({
        id: 'channel-track',
        type: 'track',
        cohortId: 'cohort-1',
        learningTrackId: 'track-1',
      });
      const { service } = buildService({
        channelsRepository: {
          listByFellowship: jest.fn(async () => [trackChannel]),
          listStudentTrackKeys: jest.fn(async () => new Set(['cohort-2:track-9'])),
        },
      });

      const result = await service.list(SCOPE, 'student-1', 'fellowship-1');
      expect(result.channels).toEqual([]);
    });

    it("includes a track channel for a Student on that channel's own cohort+track", async () => {
      const trackChannel = fakeChannel({
        id: 'channel-track',
        type: 'track',
        cohortId: 'cohort-1',
        learningTrackId: 'track-1',
      });
      const { service } = buildService({
        channelsRepository: {
          listByFellowship: jest.fn(async () => [trackChannel]),
          listStudentTrackKeys: jest.fn(async () => new Set(['cohort-1:track-1'])),
        },
      });

      const result = await service.list(SCOPE, 'student-1', 'fellowship-1');
      expect(result.channels.map((c) => c.id)).toEqual(['channel-track']);
    });

    it('never filters track channels for a caller who can create channels (admin or assigned Mentor)', async () => {
      const trackChannel = fakeChannel({
        id: 'channel-track',
        type: 'track',
        cohortId: 'cohort-1',
        learningTrackId: 'track-1',
      });
      const { service, channelsRepository } = buildService({
        channelsRepository: { listByFellowship: jest.fn(async () => [trackChannel]) },
        accessService: {
          authorize: jest.fn(async () => authorization({ canCreateChannels: true })),
        },
      });

      const result = await service.list(SCOPE, 'mentor-1', 'fellowship-1');
      expect(result.channels.map((c) => c.id)).toEqual(['channel-track']);
      expect(channelsRepository.listStudentTrackKeys).not.toHaveBeenCalled();
    });
  });

  describe('createTrackChannel', () => {
    it('creates a channel scoped to the given cohort and track', async () => {
      const { service, channelsRepository } = buildService({});

      await service.createTrackChannel(
        'org-1',
        'fellowship-1',
        { id: 'cohort-1', slug: 'cohort-2027' },
        { id: 'track-1', name: 'Software Engineering', slug: 'software-engineering' },
      );

      expect(channelsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'track',
          slug: 'track-cohort-2027-software-engineering',
          cohortId: 'cohort-1',
          learningTrackId: 'track-1',
        }),
      );
    });

    it('is idempotent — returns the existing channel instead of creating a duplicate', async () => {
      const existing = fakeChannel({ id: 'existing-track-channel', type: 'track' });
      const { service, channelsRepository } = buildService({
        channelsRepository: { findByCohortAndTrack: jest.fn(async () => existing) },
      });

      const result = await service.createTrackChannel(
        'org-1',
        'fellowship-1',
        { id: 'cohort-1', slug: 'cohort-2027' },
        { id: 'track-1', name: 'Software Engineering', slug: 'software-engineering' },
      );

      expect(result.id).toBe('existing-track-channel');
      expect(channelsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('rejects a participant (no create capability) with forbidden', async () => {
      const { service } = buildService({
        accessService: {
          authorize: jest.fn(async () => authorization({ canCreateChannels: false })),
        },
      });

      await expect(
        service.create(SCOPE, 'user-1', 'fellowship-1', { name: 'Random', slug: 'random' }),
      ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
    });

    it('rejects a duplicate slug within the same fellowship', async () => {
      const { service } = buildService({
        channelsRepository: { findByFellowshipAndSlug: jest.fn(async () => fakeChannel()) },
        accessService: {
          authorize: jest.fn(async () => authorization({ canCreateChannels: true })),
        },
      });

      await expect(
        service.create(SCOPE, 'admin-1', 'fellowship-1', { name: 'General', slug: 'general' }),
      ).rejects.toMatchObject({ response: { code: 'SLUG_TAKEN' } });
    });

    it('creates the channel and publishes a chat.channel.updated event for an authorized manager', async () => {
      const { service, events, auditLog } = buildService({
        accessService: {
          authorize: jest.fn(async () =>
            authorization({ canManageChannels: true, canCreateChannels: true }),
          ),
        },
      });

      const result = await service.create(SCOPE, 'admin-1', 'fellowship-1', {
        name: 'Announcements',
        slug: 'announcements',
        type: 'announcements',
      });

      expect(result.id).toBe('channel-1');
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'chat_channel.created' }),
      );
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'chat.channel.updated' }),
      );
    });

    it('rejects manually creating a type: track channel through the generic endpoint', async () => {
      const { service } = buildService({
        accessService: {
          authorize: jest.fn(async () => authorization({ canCreateChannels: true })),
        },
      });

      await expect(
        service.create(SCOPE, 'admin-1', 'fellowship-1', {
          name: 'Fake Track',
          slug: 'fake-track',
          type: 'track',
        }),
      ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    });

    it('allows a Mentor (canCreateChannels but not canManageChannels) to create a channel', async () => {
      const { service } = buildService({
        accessService: {
          authorize: jest.fn(async () =>
            authorization({ canManageChannels: false, canCreateChannels: true }),
          ),
        },
      });

      const result = await service.create(SCOPE, 'mentor-1', 'fellowship-1', {
        name: 'Study Group',
        slug: 'study-group',
      });
      expect(result.id).toBe('channel-1');
    });
  });

  describe('get', () => {
    it('returns not-found for a channel belonging to a different organization', async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () => fakeChannel({ organizationId: 'other-org' })),
        },
      });

      await expect(service.get(SCOPE, 'user-1', 'channel-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('returns not-found when the fellowship access check denies', async () => {
      const { service } = buildService({
        accessService: { authorize: jest.fn(async () => authorization({ allowed: false })) },
      });

      await expect(service.get(SCOPE, 'user-1', 'channel-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('returns not-found for a private channel the caller is not a member of', async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () => fakeChannel({ isPrivate: true })),
          isMember: jest.fn(async () => false),
        },
      });

      await expect(service.get(SCOPE, 'user-1', 'channel-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it("returns not-found for a track channel that isn't the Student's own cohort+track", async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () =>
            fakeChannel({ type: 'track', cohortId: 'cohort-1', learningTrackId: 'track-1' }),
          ),
          listStudentTrackKeys: jest.fn(async () => new Set(['cohort-2:track-9'])),
        },
      });

      await expect(service.get(SCOPE, 'student-1', 'channel-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it("returns the channel for a Student's own track", async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () =>
            fakeChannel({ type: 'track', cohortId: 'cohort-1', learningTrackId: 'track-1' }),
          ),
          listStudentTrackKeys: jest.fn(async () => new Set(['cohort-1:track-1'])),
        },
      });

      const result = await service.get(SCOPE, 'student-1', 'channel-1');
      expect(result.type).toBe('track');
    });
  });

  describe('listMembers', () => {
    it('returns not-found for a channel belonging to a different organization', async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () => fakeChannel({ organizationId: 'other-org' })),
        },
      });

      await expect(service.listMembers(SCOPE, 'user-1', 'channel-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('returns not-found when the fellowship access check denies', async () => {
      const { service } = buildService({
        accessService: { authorize: jest.fn(async () => authorization({ allowed: false })) },
      });

      await expect(service.listMembers(SCOPE, 'user-1', 'channel-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('returns not-found for a private channel the caller is not a member of', async () => {
      const { service } = buildService({
        channelsRepository: {
          findById: jest.fn(async () => fakeChannel({ isPrivate: true })),
          isMember: jest.fn(async () => false),
        },
      });

      await expect(service.listMembers(SCOPE, 'user-1', 'channel-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('resolves the roster to id/displayName/username for an authorized participant', async () => {
      const { service } = buildService({
        channelsRepository: {
          listMembers: jest.fn(async () => [
            {
              id: 'member-1',
              channelId: 'channel-1',
              userId: 'user-2',
              addedByUserId: null,
              addedAt: new Date('2026-01-01'),
              user: {
                id: 'user-2',
                displayName: 'Jane Doe',
                username: 'jane',
              } as never,
            },
          ]),
        },
      });

      const result = await service.listMembers(SCOPE, 'user-1', 'channel-1');
      expect(result).toEqual([{ id: 'user-2', displayName: 'Jane Doe', username: 'jane' }]);
    });
  });

  describe('update / setArchived (optimistic concurrency)', () => {
    it('requires manage capability to update', async () => {
      const { service } = buildService({
        accessService: {
          authorize: jest.fn(async () => authorization({ canManageChannels: false })),
        },
      });

      await expect(
        service.update(SCOPE, 'user-1', 'channel-1', { name: 'New name' }, 1),
      ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
    });

    it('translates a version conflict from the repository into a 409', async () => {
      const { service } = buildService({
        channelsRepository: {
          update: jest.fn(async () => {
            throw new ChatChannelVersionConflictError(5);
          }),
        },
        accessService: {
          authorize: jest.fn(async () => authorization({ canManageChannels: true })),
        },
      });

      await expect(
        service.update(SCOPE, 'admin-1', 'channel-1', { name: 'New name' }, 1),
      ).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
    });

    it('archives and publishes an update event', async () => {
      const { service, events } = buildService({
        accessService: {
          authorize: jest.fn(async () => authorization({ canManageChannels: true })),
        },
      });

      const result = await service.setArchived(SCOPE, 'admin-1', 'channel-1', true, 1);
      expect(result.archivedAt).not.toBeNull();
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'chat.channel.updated' }),
      );
    });
  });
});
