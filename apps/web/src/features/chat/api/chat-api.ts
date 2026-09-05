import type {
  AddChatReactionRequest,
  ChatChannel,
  ChatChannelReadState,
  ChatChannelTransitionRequest,
  ChatMessage,
  Cohort,
  CreateChatChannelRequest,
  CreateChatMessageRequest,
  MarkChannelReadRequest,
  UpdateChatChannelRequest,
  UpdateChatMessageRequest,
} from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

export function listChatChannels(
  fellowshipId: string,
  organizationId?: string,
): Promise<ChatChannel[]> {
  return apiRequest<ChatChannel[]>(`/fellowships/${fellowshipId}/chat/channels`, {
    organizationId,
  });
}

export function createChatChannel(
  fellowshipId: string,
  body: CreateChatChannelRequest,
  organizationId?: string,
): Promise<ChatChannel> {
  return apiRequest<ChatChannel>(`/fellowships/${fellowshipId}/chat/channels`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateChatChannel(
  channelId: string,
  body: UpdateChatChannelRequest,
  version: number,
  organizationId?: string,
): Promise<ChatChannel> {
  return apiRequest<ChatChannel>(`/chat/channels/${channelId}`, {
    method: 'PATCH',
    body,
    ifMatch: version,
    organizationId,
  });
}

export function archiveChatChannel(
  channelId: string,
  body: ChatChannelTransitionRequest,
  organizationId?: string,
): Promise<ChatChannel> {
  return apiRequest<ChatChannel>(`/chat/channels/${channelId}/actions/archive`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function restoreChatChannel(
  channelId: string,
  body: ChatChannelTransitionRequest,
  organizationId?: string,
): Promise<ChatChannel> {
  return apiRequest<ChatChannel>(`/chat/channels/${channelId}/actions/restore`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function listChatMessages(
  channelId: string,
  cursor: string | undefined,
  organizationId?: string,
): Promise<Page<ChatMessage>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequestPage<ChatMessage>(`/chat/channels/${channelId}/messages${query}`, {
    organizationId,
  });
}

export function createChatMessage(
  channelId: string,
  body: CreateChatMessageRequest,
  organizationId?: string,
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/chat/channels/${channelId}/messages`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateChatMessage(
  messageId: string,
  body: UpdateChatMessageRequest,
  organizationId?: string,
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    body,
    organizationId,
  });
}

export function deleteChatMessage(messageId: string, organizationId?: string): Promise<void> {
  return apiRequest<void>(`/chat/messages/${messageId}`, { method: 'DELETE', organizationId });
}

export function addChatReaction(
  messageId: string,
  body: AddChatReactionRequest,
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/chat/messages/${messageId}/reactions`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function removeChatReaction(
  messageId: string,
  reaction: string,
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/chat/messages/${messageId}/reactions/${encodeURIComponent(reaction)}`, {
    method: 'DELETE',
    organizationId,
  });
}

export function getChatChannelReadState(
  channelId: string,
  organizationId?: string,
): Promise<ChatChannelReadState> {
  return apiRequest<ChatChannelReadState>(`/chat/channels/${channelId}/read`, { organizationId });
}

export function markChannelRead(
  channelId: string,
  body: MarkChannelReadRequest,
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/chat/channels/${channelId}/read`, {
    method: 'POST',
    body,
    organizationId,
  });
}

/** A mentor's own context (`useMentorContext`) only carries cohort summaries
 * (id/name/slug/status/counts) — no `fellowshipId` (see
 * `MentorCohortSummary` in @forge/api-contract). Mentors already hold
 * `cohort.read` (docs/database-design.md's permission seed), so resolving
 * the one extra field chat needs reuses the existing single-cohort read
 * endpoint rather than adding a new one. */
export function getCohortFellowshipId(cohortId: string, organizationId?: string): Promise<string> {
  return apiRequest<Cohort>(`/cohorts/${cohortId}`, { organizationId }).then((c) => c.fellowshipId);
}
