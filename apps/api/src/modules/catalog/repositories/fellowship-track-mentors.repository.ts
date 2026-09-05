import { Injectable } from '@nestjs/common';
import type { FellowshipTrackMentor, Membership, User } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type FellowshipTrackMentorWithUser = FellowshipTrackMentor & {
  membership: Membership & { user: User };
};

/** Fellowship-wide, per-track mentor assignment — independent of
 * `CohortMentor` (cohort-wide access). See
 * docs/adr/0016-cohort-scoped-tracks.md Decision 2. Same "active row"
 * convention as `CohortsRepository`'s mentor methods: a hand-written
 * partial unique index (WHERE unassigned_at IS NULL) enforces one active
 * assignment per (fellowship, track, membership). */
@Injectable()
export class FellowshipTrackMentorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByTrack(learningTrackId: string): Promise<FellowshipTrackMentorWithUser[]> {
    return this.prisma.fellowshipTrackMentor.findMany({
      where: { learningTrackId, unassignedAt: null },
      include: { membership: { include: { user: true } } },
      orderBy: { assignedAt: 'asc' },
    });
  }

  findActive(
    fellowshipId: string,
    learningTrackId: string,
    membershipId: string,
  ): Promise<FellowshipTrackMentor | null> {
    return this.prisma.fellowshipTrackMentor.findFirst({
      where: { fellowshipId, learningTrackId, membershipId, unassignedAt: null },
    });
  }

  assign(
    fellowshipId: string,
    learningTrackId: string,
    membershipId: string,
  ): Promise<FellowshipTrackMentor> {
    return this.prisma.fellowshipTrackMentor.create({
      data: { fellowshipId, learningTrackId, membershipId },
    });
  }

  async unassign(
    fellowshipId: string,
    learningTrackId: string,
    membershipId: string,
  ): Promise<{ count: number }> {
    return this.prisma.fellowshipTrackMentor.updateMany({
      where: { fellowshipId, learningTrackId, membershipId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });
  }

  /** Every active track assignment for a mentor, across every Fellowship —
   * the Mentor Portal's own "my tracks" list, and the input to the
   * access-narrowing check in `MentorAccessService`. */
  listActiveForMembership(membershipId: string): Promise<FellowshipTrackMentor[]> {
    return this.prisma.fellowshipTrackMentor.findMany({
      where: { membershipId, unassignedAt: null },
    });
  }
}
