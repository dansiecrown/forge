import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatChannel, CreateChatChannelRequest } from '@forge/api-contract';
import type { Socket } from 'socket.io-client';
import { createChatChannel, listChatChannels } from '../api/chat-api';

function channelsQueryKey(fellowshipId: string | undefined) {
  return ['chat', 'channels', fellowshipId] as const;
}

export function useChatChannels(
  fellowshipId: string | undefined,
  organizationId: string | undefined,
) {
  return useQuery({
    queryKey: channelsQueryKey(fellowshipId),
    queryFn: () => listChatChannels(fellowshipId!, organizationId),
    enabled: Boolean(fellowshipId && organizationId),
  });
}

export function useCreateChatChannel(
  fellowshipId: string | undefined,
  organizationId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateChatChannelRequest) =>
      createChatChannel(fellowshipId!, body, organizationId),
    onSuccess: (channel) => {
      queryClient.setQueryData<ChatChannel[]>(channelsQueryKey(fellowshipId), (existing) => [
        ...(existing ?? []),
        channel,
      ]);
    },
  });
}

/** Keeps the channel list (names, archived state, new channels) live —
 * `chat.channel.updated` broadcasts to every socket subscribed to that
 * channel's room, but a channel the caller hasn't opened yet has no
 * subscriber locally, so this listens fellowship-wide by simply refetching
 * the cheap channel list on any such event this socket happens to see, plus
 * whenever the socket (re)connects (catches anything created while
 * offline). */
export function useChatChannelsLiveRefresh(
  socket: Socket | null,
  fellowshipId: string | undefined,
) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!socket || !fellowshipId) return;
    const invalidate = () =>
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey(fellowshipId) });
    socket.on('chat.channel.updated', invalidate);
    socket.on('connect', invalidate);
    return () => {
      socket.off('chat.channel.updated', invalidate);
      socket.off('connect', invalidate);
    };
  }, [socket, fellowshipId, queryClient]);
}
