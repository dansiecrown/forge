import type {
  CreateDirectMessageRequest,
  DirectConversation,
  DirectMessage,
  PersonSearchResult,
  StartDirectConversationRequest,
} from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

// Self-scoped throughout — no `X-Organization-Id` needed beyond what
// `apiRequest` already sends when given one; see
// `DirectMessagesController`'s own doc comment.

export function searchPeople(q: string, organizationId?: string): Promise<PersonSearchResult[]> {
  return apiRequest<PersonSearchResult[]>(`/me/people/search?q=${encodeURIComponent(q)}`, {
    organizationId,
  });
}

export function listConversations(organizationId?: string): Promise<DirectConversation[]> {
  return apiRequest<DirectConversation[]>('/me/conversations', { organizationId });
}

export function startConversation(
  body: StartDirectConversationRequest,
  organizationId?: string,
): Promise<DirectConversation> {
  return apiRequest<DirectConversation>('/me/conversations', {
    method: 'POST',
    body,
    organizationId,
  });
}

export function listConversationMessages(
  conversationId: string,
  cursor: string | undefined,
  organizationId?: string,
): Promise<Page<DirectMessage>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequestPage<DirectMessage>(`/me/conversations/${conversationId}/messages${query}`, {
    organizationId,
  });
}

export function sendConversationMessage(
  conversationId: string,
  body: CreateDirectMessageRequest,
  organizationId?: string,
): Promise<DirectMessage> {
  return apiRequest<DirectMessage>(`/me/conversations/${conversationId}/messages`, {
    method: 'POST',
    body,
    organizationId,
  });
}
