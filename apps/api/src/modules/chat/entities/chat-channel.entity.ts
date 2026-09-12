import type { ChatChannelType, FellowshipChatChannel } from '@prisma/client';

export interface ChatChannelEntity {
  id: string;
  organizationId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  description: string | null;
  type: ChatChannelType;
  isPrivate: boolean;
  /** Set only for `type: 'track'` channels — see
   * docs/adr/0014-fellowship-chat.md's 2026-09-12 addendum. */
  cohortId: string | null;
  learningTrackId: string | null;
  archivedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toChatChannelEntity(row: FellowshipChatChannel): ChatChannelEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fellowshipId: row.fellowshipId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    type: row.type,
    isPrivate: row.isPrivate,
    cohortId: row.cohortId,
    learningTrackId: row.learningTrackId,
    archivedAt: row.archivedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
