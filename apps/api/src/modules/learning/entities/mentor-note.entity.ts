import type { MentorNote } from '@prisma/client';

export interface MentorNoteEntity {
  id: string;
  cohortId: string;
  enrollmentId: string;
  authorMembershipId: string;
  body: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toMentorNoteEntity(row: MentorNote): MentorNoteEntity {
  return {
    id: row.id,
    cohortId: row.cohortId,
    enrollmentId: row.enrollmentId,
    authorMembershipId: row.authorMembershipId,
    body: row.body,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
