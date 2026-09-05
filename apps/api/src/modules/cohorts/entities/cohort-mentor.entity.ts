import type { CohortMentor } from '@prisma/client';

export interface CohortMentorEntity {
  id: string;
  cohortId: string;
  membershipId: string;
  assignedAt: Date;
}

export function toCohortMentorEntity(row: CohortMentor): CohortMentorEntity {
  return {
    id: row.id,
    cohortId: row.cohortId,
    membershipId: row.membershipId,
    assignedAt: row.assignedAt,
  };
}
