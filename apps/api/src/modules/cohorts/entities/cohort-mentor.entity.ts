import type { CohortMentor } from '@prisma/client';

export interface CohortMentorEntity {
  id: string;
  cohortId: string;
  membershipId: string;
  /** Resolved server-side via the membership's user — see
   * docs/adr/0015-name-first-display.md. */
  userDisplayName: string;
  userEmail: string;
  assignedAt: Date;
}

export function toCohortMentorEntity(
  row: CohortMentor,
  user: { displayName: string; emailCanonical: string },
): CohortMentorEntity {
  return {
    id: row.id,
    cohortId: row.cohortId,
    membershipId: row.membershipId,
    userDisplayName: user.displayName,
    userEmail: user.emailCanonical,
    assignedAt: row.assignedAt,
  };
}
