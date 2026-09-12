import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { ChatMessage } from '@forge/api-contract';
import type { Socket } from 'socket.io-client';
import type { Page } from '@/api/client';
import {
  addChatReaction,
  createChatMessage,
  deleteChatMessage,
  listChatMessages,
  markChannelRead,
  removeChatReaction,
  updateChatMessage,
} from '../api/chat-api';

type MessagesPageData = InfiniteData<Page<ChatMessage>>;

function messagesQueryKey(channelId: string | undefined) {
  return ['chat', 'messages', channelId] as const;
}

/** Pages come back newest-first (page 0 = latest, each further page older —
 * see `ChatMessagesRepository.list`'s doc comment); flattened for display in
 * chronological (oldest → newest) order, oldest page first. */
function flattenChronological(data: MessagesPageData | undefined): ChatMessage[] {
  if (!data) return [];
  const chronological: ChatMessage[] = [];
  for (const page of [...data.pages].reverse()) {
    chronological.push(...[...page.items].reverse());
  }
  return chronological;
}

/** Idempotent insert-or-replace-by-id into page 0 (a genuinely new message
 * is always the newest thing seen) — shared by the create/update/delete/
 * reaction realtime events and by a mutation's own optimistic-confirm, so
 * whichever arrives first (REST response or the Redis-relayed broadcast)
 * "wins" and the other is a harmless no-op. */
function upsertMessage(data: MessagesPageData | undefined, message: ChatMessage): MessagesPageData {
  if (!data || data.pages.length === 0) {
    return {
      pages: [
        {
          items: [message],
          page: { nextCursor: null, previousCursor: null, limit: 25, hasMore: false },
        },
      ],
      pageParams: [undefined],
    };
  }
  let found = false;
  const pages = data.pages.map((page) => {
    if (!page.items.some((item) => item.id === message.id)) return page;
    found = true;
    return { ...page, items: page.items.map((item) => (item.id === message.id ? message : item)) };
  });
  if (found) return { ...data, pages };
  const [first, ...rest] = pages;
  return { ...data, pages: [{ ...first, items: [message, ...first.items] }, ...rest] };
}

export interface PendingMessage {
  tempId: string;
  content: string;
  replyToMessageId?: string;
  status: 'sending' | 'failed';
  createdAt: string;
}

export function useChatMessages(
  channelId: string | undefined,
  organizationId: string | undefined,
  socket: Socket | null,
  subscribed: boolean,
) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingMessage[]>([]);

  const query = useInfiniteQuery({
    queryKey: messagesQueryKey(channelId),
    queryFn: ({ pageParam }) => listChatMessages(channelId!, pageParam, organizationId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? (lastPage.page.nextCursor ?? undefined) : undefined,
    enabled: Boolean(channelId && organizationId),
  });

  const upsert = useCallback(
    (message: ChatMessage) => {
      queryClient.setQueryData<MessagesPageData>(messagesQueryKey(channelId), (existing) =>
        upsertMessage(existing, message),
      );
    },
    [queryClient, channelId],
  );

  // Real-time updates. Never the *only* way a sender sees their own
  // message (see the mutation below) — this covers everyone else, and
  // redundantly (harmlessly) re-confirms the sender's own optimistic send
  // when Redis is actually up.
  useEffect(() => {
    if (!socket || !channelId) return;
    function onCreated(message: ChatMessage) {
      if (message.channelId !== channelId) return;
      upsert(message);
    }
    socket.on('chat.message.created', onCreated);
    socket.on('chat.message.updated', onCreated);
    socket.on('chat.message.deleted', onCreated);
    socket.on('chat.reaction.updated', onCreated);
    return () => {
      socket.off('chat.message.created', onCreated);
      socket.off('chat.message.updated', onCreated);
      socket.off('chat.message.deleted', onCreated);
      socket.off('chat.reaction.updated', onCreated);
    };
  }, [socket, channelId, upsert]);

  // A fresh subscription (initial, or after a reconnect) means the socket
  // may have missed events while it was down — Redis is never the source
  // of truth for messages, so the recovery path is simply "refetch the
  // latest page from Postgres", not "replay a backlog over the socket".
  const wasSubscribed = useRef(false);
  useEffect(() => {
    if (subscribed && !wasSubscribed.current) {
      void queryClient.invalidateQueries({
        queryKey: messagesQueryKey(channelId),
        refetchType: 'active',
      });
    }
    wasSubscribed.current = subscribed;
  }, [subscribed, channelId, queryClient]);

  const messages = useMemo(() => flattenChronological(query.data), [query.data]);

  const sendMessage = useCallback(
    (content: string, replyToMessageId?: string) => {
      if (!channelId) return;
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setPending((prev) => [
        ...prev,
        {
          tempId,
          content,
          replyToMessageId,
          status: 'sending',
          createdAt: new Date().toISOString(),
        },
      ]);
      createChatMessage(channelId, { content, replyToMessageId }, organizationId)
        .then((message) => {
          upsert(message);
          setPending((prev) => prev.filter((p) => p.tempId !== tempId));
        })
        .catch(() => {
          setPending((prev) =>
            prev.map((p) => (p.tempId === tempId ? { ...p, status: 'failed' } : p)),
          );
        });
    },
    [channelId, organizationId, upsert],
  );

  const retryPending = useCallback(
    (tempId: string) => {
      const item = pending.find((p) => p.tempId === tempId);
      if (!item || !channelId) return;
      setPending((prev) =>
        prev.map((p) => (p.tempId === tempId ? { ...p, status: 'sending' } : p)),
      );
      createChatMessage(
        channelId,
        { content: item.content, replyToMessageId: item.replyToMessageId },
        organizationId,
      )
        .then((message) => {
          upsert(message);
          setPending((prev) => prev.filter((p) => p.tempId !== tempId));
        })
        .catch(() => {
          setPending((prev) =>
            prev.map((p) => (p.tempId === tempId ? { ...p, status: 'failed' } : p)),
          );
        });
    },
    [pending, channelId, organizationId, upsert],
  );

  const dismissPending = useCallback((tempId: string) => {
    setPending((prev) => prev.filter((p) => p.tempId !== tempId));
  }, []);

  const editMessage = useCallback(
    (messageId: string, content: string) =>
      updateChatMessage(messageId, { content }, organizationId).then(upsert),
    [organizationId, upsert],
  );

  const deleteMessage = useCallback(
    (messageId: string) =>
      deleteChatMessage(messageId, organizationId).then(() => {
        const current = query.data;
        const found = current?.pages.flatMap((p) => p.items).find((m) => m.id === messageId);
        if (found) upsert({ ...found, content: '', deletedAt: new Date().toISOString() });
      }),
    [organizationId, upsert, query.data],
  );

  const toggleReaction = useCallback(
    (message: ChatMessage, reaction: string, currentUserId: string) => {
      const alreadyReacted = message.reactions.some(
        (r) => r.reaction === reaction && r.userId === currentUserId,
      );
      const action = alreadyReacted
        ? removeChatReaction(message.id, reaction, organizationId)
        : addChatReaction(message.id, { reaction }, organizationId);
      // Optimistic flip — reverted automatically on the next authoritative
      // upsert (the REST call's own completion doesn't return the message,
      // so this relies on the subsequent `chat.reaction.updated` broadcast;
      // if Redis is down, the channel is re-synced on the next reconnect/
      // refetch instead, same as any other missed-event case).
      const optimistic: ChatMessage = {
        ...message,
        reactions: alreadyReacted
          ? message.reactions.filter(
              (r) => !(r.reaction === reaction && r.userId === currentUserId),
            )
          : [...message.reactions, { reaction, userId: currentUserId }],
      };
      upsert(optimistic);
      return action;
    },
    [organizationId, upsert],
  );

  const markRead = useCallback(
    (lastReadMessageId?: string) => {
      if (!channelId) return;
      void markChannelRead(channelId, { lastReadMessageId }, organizationId);
    },
    [channelId, organizationId],
  );

  return {
    messages,
    pending,
    isLoading: query.isLoading,
    isError: query.isError,
    hasOlder: query.hasNextPage,
    isFetchingOlder: query.isFetchingNextPage,
    fetchOlder: query.fetchNextPage,
    sendMessage,
    retryPending,
    dismissPending,
    editMessage,
    deleteMessage,
    toggleReaction,
    markRead,
  };
}
