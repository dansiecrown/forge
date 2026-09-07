import type { FellowshipChatChannelMember, User } from '@prisma/client';

/** Roster entry for `GET /chat/channels/:channelId/members` — see
 * docs/adr/0014-fellowship-chat.md's 2026-09-07 addendum. Shaped identically
 * to `PersonSearchResult` (packages/api-contract) so the frontend can feed a
 * roster row straight into the same "start a DM" flow it already uses for
 * search results, with no adapter in between. */
export interface ChatChannelMemberEntity {
  id: string;
  displayName: string;
  username: string | null;
}

export function toChatChannelMemberEntity(
  row: FellowshipChatChannelMember & { user: User },
): ChatChannelMemberEntity {
  return {
    id: row.user.id,
    displayName: row.user.displayName,
    username: row.user.username,
  };
}
