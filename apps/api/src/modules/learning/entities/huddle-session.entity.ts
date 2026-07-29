import type { HuddleSession } from '@prisma/client';

export interface HuddleSessionEntity {
  id: string;
  cohortId: string;
  weekNumber: number;
  notes: string | null;
  discussionTopics: string[];
  actionItems: string[];
  createdByMembershipId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toHuddleSessionEntity(row: HuddleSession): HuddleSessionEntity {
  return {
    id: row.id,
    cohortId: row.cohortId,
    weekNumber: row.weekNumber,
    notes: row.notes,
    discussionTopics: row.discussionTopics,
    actionItems: row.actionItems,
    createdByMembershipId: row.createdByMembershipId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
