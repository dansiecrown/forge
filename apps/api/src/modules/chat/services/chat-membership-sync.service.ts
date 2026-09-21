import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ChatChannelsRepository } from '../repositories/chat-channels.repository';

/** Keeps a Fellowship's `#general` channel and its `type: 'track'` channels'
 * real membership rows (`FellowshipChatChannelMember`) in sync with
 * Enrollment/CohortMentor state — a deliberate, disclosed reversal of
 * ADR-0014 Decision 1's "no FellowshipMembership table, access is derived,
 * never stored" stance. Originally scoped to `#general` + student enrollment
 * only; extended 2026-09-14 to also cover `type: 'track'` channels (on track
 * selection) and Mentor assignment, on explicit product request — see this
 * service's own file-level ADR addendum.
 *
 * This never changes how access itself is authorized — `ChatAccessService`/
 * `ChatChannelsService.list()`/`ChatMessagesService` remain the sole
 * authority for "can this person read/write this channel" and compute that
 * live from `Enrollment.currentLearningTrackId`/`CohortMentor`, completely
 * unaware this table is now populated. These rows exist only to back a real,
 * listable "who's in this channel" roster (`GET /chat/channels/:id/members`),
 * which `FellowshipChatChannelMember` was always modeled for but nothing
 * populated before this. */
@Injectable()
export class ChatMembershipSyncService {
  private readonly logger = new Logger('ChatMembershipSync');

  constructor(
    private readonly channelsRepository: ChatChannelsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Called by `EnrollmentsService.update()` on every status transition.
   * `hasAccess` should mirror exactly the same status set
   * `ChatAccessService.authorize()` already checks for a Student
   * (`active`/`paused`/`completed`) — kept as a caller-supplied boolean
   * rather than importing that check here, to avoid a new inter-module
   * dependency for a one-line condition. Never throws: a sync failure must
   * not fail the enrollment status change that triggered it — the roster
   * is a convenience, not the access-control path. */
  async syncStudentMembership(
    fellowshipId: string,
    userId: string,
    hasAccess: boolean,
  ): Promise<void> {
    try {
      const channel = await this.channelsRepository.findGeneralChannel(fellowshipId);
      if (!channel) {
        this.logger.warn(
          `No #general channel found for fellowship ${fellowshipId}; skipping sync.`,
        );
        return;
      }
      if (hasAccess) {
        await this.channelsRepository.addMember(channel.id, userId);
      } else {
        await this.channelsRepository.removeMember(channel.id, userId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync chat membership for user ${userId} in fellowship ${fellowshipId}: ${(error as Error).message}`,
      );
    }
  }

  /** Called by `EnrollmentsService.selectTrack()`/`.update()` whenever a
   * Student's `currentLearningTrackId` changes. A student's *access* to a
   * track channel was already instant and independent of this row (`list()`/
   * `requireChannelAccess()` compute it live from the enrollment itself) —
   * this only makes the member roster reflect reality immediately, the same
   * way `syncStudentMembership()` already does for `#general`. Removes the
   * student from their *previous* track's channel roster on a switch, so the
   * roster never shows someone in two track channels at once. Never throws;
   * a missing channel (e.g. one not yet created for a newly offered track)
   * is logged and skipped, not fatal. */
  async syncTrackMembership(
    cohortId: string,
    userId: string,
    previousTrackId: string | null,
    newTrackId: string | null,
  ): Promise<void> {
    try {
      if (previousTrackId && previousTrackId !== newTrackId) {
        const previousChannel = await this.channelsRepository.findByCohortAndTrack(
          cohortId,
          previousTrackId,
        );
        if (previousChannel) {
          await this.channelsRepository.removeMember(previousChannel.id, userId);
        }
      }
      if (newTrackId) {
        const channel = await this.channelsRepository.findByCohortAndTrack(cohortId, newTrackId);
        if (!channel) {
          this.logger.warn(
            `No track channel found for cohort ${cohortId} track ${newTrackId}; skipping sync.`,
          );
          return;
        }
        await this.channelsRepository.addMember(channel.id, userId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync track chat membership for user ${userId} in cohort ${cohortId}: ${(error as Error).message}`,
      );
    }
  }

  /** Called by `CohortsService.assignMentor()`/`.unassignMentor()` — adds or
   * removes a Mentor from every existing channel belonging to the Cohort
   * they were just assigned to/from (`#general` plus every `type: 'track'`
   * channel that cohort currently has). A Mentor's *access* is already
   * instant and fellowship-wide the moment `ChatAccessService` sees their
   * assignment (see that service's doc comment); this only keeps the
   * roster accurate. Never throws. */
  async syncMentorMembership(
    fellowshipId: string,
    cohortId: string,
    userId: string,
    hasAccess: boolean,
  ): Promise<void> {
    try {
      const channels = await this.channelsRepository.listCohortChannels(fellowshipId, cohortId);
      for (const channel of channels) {
        if (hasAccess) {
          await this.channelsRepository.addMember(channel.id, userId);
        } else {
          await this.channelsRepository.removeMember(channel.id, userId);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync mentor chat membership for user ${userId} in cohort ${cohortId}: ${(error as Error).message}`,
      );
    }
  }

  /** Called right after `ChatChannelsService.createTrackChannel()` creates a
   * *new* `type: 'track'` channel — populates its roster immediately with
   * every Student already on that track and every Mentor already assigned
   * to that Cohort, so a channel created after those relationships already
   * existed (a track added mid-cohort, or backfilled for a track offered
   * before this sync existed) doesn't start with an empty roster despite
   * real, already-granted access. Never throws. */
  async backfillTrackChannelRoster(
    channelId: string,
    cohortId: string,
    learningTrackId: string,
  ): Promise<void> {
    try {
      const [enrollments, mentors] = await Promise.all([
        this.prisma.enrollment.findMany({
          where: {
            cohortId,
            currentLearningTrackId: learningTrackId,
            status: { in: ['active', 'paused', 'completed'] },
          },
          select: { userId: true },
        }),
        this.prisma.cohortMentor.findMany({
          where: { cohortId, unassignedAt: null },
          select: { membership: { select: { userId: true } } },
        }),
      ]);
      const userIds = new Set<string>([
        ...enrollments.map((enrollment) => enrollment.userId),
        ...mentors.map((mentor) => mentor.membership.userId),
      ]);
      for (const userId of userIds) {
        await this.channelsRepository.addMember(channelId, userId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to backfill roster for track channel ${channelId}: ${(error as Error).message}`,
      );
    }
  }
}
