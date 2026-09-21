import { ChatMembershipSyncService } from './chat-membership-sync.service';
import type { ChatChannelsRepository } from '../repositories/chat-channels.repository';
import type { PrismaService } from '../../../database/prisma.service';

/** Milestone 10 (post-launch stabilization): this service had zero unit
 * coverage despite being the exact mechanism a live data-integrity audit
 * found a real gap in — a student enrolled onto a track whose channel
 * predated `backfillTrackChannelRoster()`'s existence was missing from that
 * channel's roster (fixed via `prisma/repairs/repair-chat-membership.ts`).
 * These tests cover the reconciliation logic directly so the same class of
 * gap is caught by the suite next time, not just by a live audit. */
describe('ChatMembershipSyncService', () => {
  function fakeChannelsRepository(overrides: Partial<ChatChannelsRepository> = {}) {
    return {
      findGeneralChannel: jest.fn(async () => ({ id: 'general-channel' })),
      findByCohortAndTrack: jest.fn(async () => ({ id: 'track-channel' })),
      listCohortChannels: jest.fn(async () => [{ id: 'general-channel' }, { id: 'track-channel' }]),
      addMember: jest.fn(async () => undefined),
      removeMember: jest.fn(async () => undefined),
      ...overrides,
    } as unknown as ChatChannelsRepository;
  }

  describe('backfillTrackChannelRoster', () => {
    it('adds every currently-enrolled student and every active mentor to the channel', async () => {
      const channels = fakeChannelsRepository();
      const prisma = {
        enrollment: {
          findMany: jest.fn(async () => [{ userId: 'student-1' }, { userId: 'student-2' }]),
        },
        cohortMentor: {
          findMany: jest.fn(async () => [{ membership: { userId: 'mentor-1' } }]),
        },
      } as unknown as PrismaService;
      const service = new ChatMembershipSyncService(channels, prisma);

      await service.backfillTrackChannelRoster('channel-1', 'cohort-1', 'track-1');

      expect(channels.addMember).toHaveBeenCalledWith('channel-1', 'student-1');
      expect(channels.addMember).toHaveBeenCalledWith('channel-1', 'student-2');
      expect(channels.addMember).toHaveBeenCalledWith('channel-1', 'mentor-1');
      expect(channels.addMember).toHaveBeenCalledTimes(3);
    });

    it('never lets a lookup failure escape (roster sync is a convenience, not the access path)', async () => {
      const channels = fakeChannelsRepository();
      const prisma = {
        enrollment: { findMany: jest.fn(async () => Promise.reject(new Error('db down'))) },
        cohortMentor: { findMany: jest.fn(async () => []) },
      } as unknown as PrismaService;
      const service = new ChatMembershipSyncService(channels, prisma);

      await expect(
        service.backfillTrackChannelRoster('channel-1', 'cohort-1', 'track-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('syncTrackMembership', () => {
    it('adds the student to the new track channel and removes them from the previous one', async () => {
      const channels = fakeChannelsRepository();
      const service = new ChatMembershipSyncService(channels, {} as PrismaService);

      await service.syncTrackMembership('cohort-1', 'student-1', 'old-track', 'new-track');

      expect(channels.findByCohortAndTrack).toHaveBeenCalledWith('cohort-1', 'old-track');
      expect(channels.findByCohortAndTrack).toHaveBeenCalledWith('cohort-1', 'new-track');
      expect(channels.removeMember).toHaveBeenCalledWith('track-channel', 'student-1');
      expect(channels.addMember).toHaveBeenCalledWith('track-channel', 'student-1');
    });

    it('does not remove anything on a first-ever track pick (no previous track)', async () => {
      const channels = fakeChannelsRepository();
      const service = new ChatMembershipSyncService(channels, {} as PrismaService);

      await service.syncTrackMembership('cohort-1', 'student-1', null, 'new-track');

      expect(channels.removeMember).not.toHaveBeenCalled();
      expect(channels.addMember).toHaveBeenCalledWith('track-channel', 'student-1');
    });

    it('skips silently when the target track has no channel yet', async () => {
      const channels = fakeChannelsRepository({ findByCohortAndTrack: jest.fn(async () => null) });
      const service = new ChatMembershipSyncService(channels, {} as PrismaService);

      await expect(
        service.syncTrackMembership('cohort-1', 'student-1', null, 'new-track'),
      ).resolves.toBeUndefined();
      expect(channels.addMember).not.toHaveBeenCalled();
    });
  });

  describe('syncMentorMembership', () => {
    it('adds the mentor to every one of the cohort’s channels when granted access', async () => {
      const channels = fakeChannelsRepository();
      const service = new ChatMembershipSyncService(channels, {} as PrismaService);

      await service.syncMentorMembership('fellowship-1', 'cohort-1', 'mentor-1', true);

      expect(channels.addMember).toHaveBeenCalledWith('general-channel', 'mentor-1');
      expect(channels.addMember).toHaveBeenCalledWith('track-channel', 'mentor-1');
      expect(channels.removeMember).not.toHaveBeenCalled();
    });

    it('removes the mentor from every one of the cohort’s channels when access is revoked', async () => {
      const channels = fakeChannelsRepository();
      const service = new ChatMembershipSyncService(channels, {} as PrismaService);

      await service.syncMentorMembership('fellowship-1', 'cohort-1', 'mentor-1', false);

      expect(channels.removeMember).toHaveBeenCalledWith('general-channel', 'mentor-1');
      expect(channels.removeMember).toHaveBeenCalledWith('track-channel', 'mentor-1');
      expect(channels.addMember).not.toHaveBeenCalled();
    });
  });
});
