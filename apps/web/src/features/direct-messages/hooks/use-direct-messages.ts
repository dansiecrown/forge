import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DirectMessage } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  listConversationMessages,
  listConversations,
  searchPeople,
  sendConversationMessage,
  startConversation,
} from '../api/direct-messages-api';

// Polling, not the WebSocket gateway — see docs/adr/0014-fellowship-chat.md's
// 2026-09-06 addendum for why. Matches the Notification bell's own existing
// polling cadence for "near-real-time enough" self-service data.
const CONVERSATIONS_POLL_MS = 15_000;
const MESSAGES_POLL_MS = 5_000;

export function usePeopleSearch(query: string, minLength = 2) {
  const { activeOrganizationId } = useActiveOrganization();
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['direct-messages', 'people-search', trimmed, activeOrganizationId],
    queryFn: () => searchPeople(trimmed, activeOrganizationId),
    enabled: trimmed.length >= minLength && Boolean(activeOrganizationId),
  });
}

export function useConversations() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['direct-messages', 'conversations', activeOrganizationId],
    queryFn: () => listConversations(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
    refetchInterval: CONVERSATIONS_POLL_MS,
  });
}

export function useStartConversation() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => startConversation({ userId }, activeOrganizationId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['direct-messages', 'conversations'] }),
  });
}

export function useConversationMessages(conversationId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<DirectMessage[]>([]);

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [conversationId]);

  const query = useQuery({
    queryKey: ['direct-messages', 'messages', conversationId, cursor],
    queryFn: () => listConversationMessages(conversationId as string, cursor, activeOrganizationId),
    enabled: Boolean(conversationId) && Boolean(activeOrganizationId),
    refetchInterval: cursor === undefined ? MESSAGES_POLL_MS : false,
  });

  const rows =
    cursor === undefined ? (query.data?.items ?? []) : [...items, ...(query.data?.items ?? [])];

  function loadOlder() {
    if (query.data?.page.nextCursor) {
      setItems(rows);
      setCursor(query.data.page.nextCursor);
    }
  }

  return {
    rows,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    hasMore: query.data?.page.hasMore ?? false,
    loadOlder,
  };
}

export function useSendConversationMessage(conversationId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      sendConversationMessage(conversationId as string, { content }, activeOrganizationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['direct-messages', 'messages', conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['direct-messages', 'conversations'] });
    },
  });
}
