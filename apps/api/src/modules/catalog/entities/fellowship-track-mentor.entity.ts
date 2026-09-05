import type { FellowshipTrackMentor } from '@prisma/client';

export interface FellowshipTrackMentorEntity {
  id: string;
  fellowshipId: string;
  learningTrackId: string;
  membershipId: string;
  /** Resolved server-side — see docs/adr/0015-name-first-display.md. */
  userDisplayName: string;
  userEmail: string;
  assignedAt: Date;
}

export function toFellowshipTrackMentorEntity(
  row: FellowshipTrackMentor,
  user: { displayName: string; emailCanonical: string },
): FellowshipTrackMentorEntity {
  return {
    id: row.id,
    fellowshipId: row.fellowshipId,
    learningTrackId: row.learningTrackId,
    membershipId: row.membershipId,
    userDisplayName: user.displayName,
    userEmail: user.emailCanonical,
    assignedAt: row.assignedAt,
  };
}
