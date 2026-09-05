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
    archivedAt: row.archivedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
