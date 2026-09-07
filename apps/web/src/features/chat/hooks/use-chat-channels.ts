import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChatChannelTransitionRequest,
  CreateChatChannelRequest,
  UpdateChatChannelRequest,
} from '@forge/api-contract';
import type { Socket } from 'socket.io-client';
import {
  archiveChatChannel,
  createChatChannel,
  listChatChannels,
  restoreChatChannel,
  updateChatChannel,
} from '../api/chat-api';

/** A prefix, not a full key — `invalidateQueries` matches every query whose
 * key starts with this, so it catches both the `includeArchived: true` and
 * `false` variants `useChatChannels` below can be watching at once. Every
 * mutation hook here invalidates rather than hand-patches the cached array,
 * specifically so it stays correct regardless of which variant(s) a given
 * screen currently has mounted. */
function channelsQueryKey(fellowshipId: string | undefined) {
  return ['chat', 'channels', fellowshipId] as const;
}

export function useChatChannels(
  fellowshipId: string | undefined,
  organizationId: string | undefined,
  includeArchived = false,
) {
  return useQuery({
    queryKey: [...channelsQueryKey(fellowshipId), { includeArchived }],
    queryFn: () => listChatChannels(fellowshipId!, organizationId, includeArchived),
    enabled: Boolean(fellowshipId && organizationId),
  });
}

function useInvalidateChannels(fellowshipId: string | undefined) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: channelsQueryKey(fellowshipId) });
}

export function useCreateChatChannel(
  fellowshipId: string | undefined,
  organizationId: string | undefined,
) {
  const invalidate = useInvalidateChannels(fellowshipId);
  return useMutation({
    mutationFn: (body: CreateChatChannelRequest) =>
      createChatChannel(fellowshipId!, body, organizationId),
    onSuccess: invalidate,
  });
}

/** Rename/re-describe — `chat.channel.manage` only, enforced server-side;
 * the frontend only needs to hide the triggering UI from anyone else. */
export function useUpdateChatChannel(
  fellowshipId: string | undefined,
  organizationId: string | undefined,
) {
  const invalidate = useInvalidateChannels(fellowshipId);
  return useMutation({
    mutationFn: ({
      channelId,
      body,
      version,
    }: {
      channelId: string;
      body: UpdateChatChannelRequest;
      version: number;
    }) => updateChatChannel(channelId, body, version, organizationId),
    onSuccess: invalidate,
  });
}

export function useArchiveChatChannel(
  fellowshipId: string | undefined,
  organizationId: string | undefined,
) {
  const invalidate = useInvalidateChannels(fellowshipId);
  return useMutation({
    mutationFn: ({ channelId, body }: { channelId: string; body: ChatChannelTransitionRequest }) =>
      archiveChatChannel(channelId, body, organizationId),
    onSuccess: invalidate,
  });
}

export function useRestoreChatChannel(
  fellowshipId: string | undefined,
  organizationId: string | undefined,
) {
  const invalidate = useInvalidateChannels(fellowshipId);
  return useMutation({
    mutationFn: ({ channelId, body }: { channelId: string; body: ChatChannelTransitionRequest }) =>
      restoreChatChannel(channelId, body, organizationId),
    onSuccess: invalidate,
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
