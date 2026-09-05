import type { Enrollment } from '@prisma/client';

export interface EnrollmentEntity {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  cohortId: string;
  userId: string;
  /** Resolved server-side so the frontend never has to show a bare id — see
   * docs/adr/0015-name-first-display.md. Null only if the user record has
   * somehow been removed (Enrollment has no cascading FK to User); every
   * caller should still fall back to `userId` in that edge case. */
  userDisplayName: string | null;
  userEmail: string | null;
  status: string;
  /** The learner's single active Learning Track within this Fellowship —
   * see docs/adr/0006-curriculum-learning-engine.md. */
  currentLearningTrackId: string | null;
  invitedAt: Date;
  joinedAt: Date | null;
  endedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toEnrollmentEntity(
  row: Enrollment,
  user?: { displayName: string; emailCanonical: string } | null,
): EnrollmentEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    academyId: row.academyId,
    fellowshipId: row.fellowshipId,
    cohortId: row.cohortId,
    userId: row.userId,
    userDisplayName: user?.displayName ?? null,
    userEmail: user?.emailCanonical ?? null,
    status: row.status,
    currentLearningTrackId: row.currentLearningTrackId,
    invitedAt: row.invitedAt,
    joinedAt: row.joinedAt,
    endedAt: row.endedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
