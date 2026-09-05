import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { getChatChannelReadState } from '../api/chat-api';

function readStateQueryKey(channelId: string | undefined) {
  return ['chat', 'read-state', channelId] as const;
}

/** One small query per channel — fellowships have a handful of channels at
 * most (#general plus a few standard/announcement channels), so this stays
 * well clear of the "unbounded list" concern Phase 12 warns about. Kept
 * fresh by new-message events (any message in the channel can change its
 * unread count) rather than polling. */
export function useChatReadState(channelId: string | undefined, socket: Socket | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: readStateQueryKey(channelId),
    queryFn: () => getChatChannelReadState(channelId!),
    enabled: Boolean(channelId),
  });

  useEffect(() => {
    if (!socket || !channelId) return;
    const invalidate = () =>
      void queryClient.invalidateQueries({ queryKey: readStateQueryKey(channelId) });
    socket.on('chat.message.created', invalidate);
    return () => {
      socket.off('chat.message.created', invalidate);
    };
  }, [socket, channelId, queryClient]);

  return query;
}

/** Call after `markChannelRead` succeeds to zero the badge immediately,
 * instead of waiting for the next background refetch. */
export function useResetChatReadState() {
  const queryClient = useQueryClient();
  return (channelId: string, lastReadMessageId: string | undefined) => {
    queryClient.setQueryData(readStateQueryKey(channelId), {
      lastReadMessageId: lastReadMessageId ?? null,
      lastReadAt: new Date().toISOString(),
      unreadCount: 0,
    });
  };
}
