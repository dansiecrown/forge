import { Injectable, Logger } from '@nestjs/common';
import { ChatChannelsRepository } from '../repositories/chat-channels.repository';

/** Keeps a Fellowship's default `#general` channel's real membership rows
 * (`FellowshipChatChannelMember`) in sync with Enrollment status — a
 * deliberate, disclosed reversal of ADR-0014 Decision 1's "no
 * FellowshipMembership table, access is derived, never stored" stance,
 * scoped specifically to student enrollment on request (not the
 * CohortMentor side of that same decision, which remains purely computed
 * for now — see this service's own file-level ADR addendum).
 *
 * This never changes how access itself is authorized — `ChatAccessService`
 * remains the sole authority for "can this person read/write this channel"
 * and is completely unaware this table is now populated. These rows exist
 * only to back a real, listable "who's in this channel" roster
 * (`GET /chat/channels/:id/members`), which `FellowshipChatChannelMember`
 * was always modeled for but nothing ever populated before this. */
@Injectable()
export class ChatMembershipSyncService {
  private readonly logger = new Logger('ChatMembershipSync');

  constructor(private readonly channelsRepository: ChatChannelsRepository) {}

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
}
