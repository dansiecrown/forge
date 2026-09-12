import { useQuery } from '@tanstack/react-query';
import { listChatChannelMembers } from '../api/chat-api';

/** A channel's roster — the "start a conversation directly with them"
 * feature. Not live-refreshed over the socket (unlike the channel list):
 * membership only changes on an enrollment status transition, an
 * infrequent, non-realtime event, so a normal query-cache lifetime is
 * enough. See docs/adr/0014-fellowship-chat.md's 2026-09-07 addendum. */
export function useChatChannelMembers(
  channelId: string | undefined,
  organizationId: string | undefined,
) {
  return useQuery({
    queryKey: ['chat', 'channel-members', channelId, organizationId],
    queryFn: () => listChatChannelMembers(channelId!, organizationId),
    enabled: Boolean(channelId && organizationId),
  });
}
