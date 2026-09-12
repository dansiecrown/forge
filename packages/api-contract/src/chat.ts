// Hand-authored request/response contracts for Fellowship Chat — see
// docs/adr/0014-fellowship-chat.md. Fellowship is the communication
// boundary (not Cohort, not Organization); there is deliberately no
// FellowshipChatAdmin role — access is derived from the same Enrollment/
// CohortMentor/admin-scope relationships every other module already uses.

export type ChatChannelType = 'general' | 'announcements' | 'standard' | 'track';

export interface ChatChannel {
  id: string;
  organizationId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  description: string | null;
  type: ChatChannelType;
  isPrivate: boolean;
  /** Set only for `type: 'track'` channels — see this file's `type: 'track'`
   * addendum in docs/adr/0014-fellowship-chat.md (2026-09-12). */
  cohortId: string | null;
  learningTrackId: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatChannelRequest {
  name: string;
  slug: string;
  description?: string;
  type?: ChatChannelType;
  isPrivate?: boolean;
}

/** `GET /fellowships/:fellowshipId/chat/channels` — a breaking response-
 * shape change (2026-09-12, was a bare `ChatChannel[]`): the caller's own
 * `canManageChannels`/`canCreateChannels` for *this* Fellowship travel
 * alongside the list, since a static role-permission check on the frontend
 * can't express "this Mentor may create a channel here, but not in every
 * Fellowship." See docs/adr/0014-fellowship-chat.md's 2026-09-12 addendum. */
export interface ListChatChannelsResponse {
  channels: ChatChannel[];
  canManageChannels: boolean;
  canCreateChannels: boolean;
}

export interface UpdateChatChannelRequest {
  name?: string;
  description?: string;
}

export interface ChatChannelTransitionRequest {
  version: number;
}

/** `GET /chat/channels/:channelId/members` — see
 * docs/adr/0014-fellowship-chat.md's 2026-09-07 addendum. Shaped identically
 * to `PersonSearchResult` below so a roster row can be passed straight into
 * the same "start a DM" flow as a search result. */
export type ChatChannelMember = PersonSearchResult;

export interface ChatMessageReaction {
  reaction: string;
  userId: string;
}

export interface ChatMessageReplyPreview {
  authorDisplayName: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorDisplayName: string | null;
  /** Empty string for a soft-deleted message — the row (and any replies
   * pointing at it) survive, but the content is never served back out. */
  content: string;
  replyToMessageId: string | null;
  replyToPreview: ChatMessageReplyPreview | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reactions: ChatMessageReaction[];
}

export interface CreateChatMessageRequest {
  content: string;
  replyToMessageId?: string;
}

export interface UpdateChatMessageRequest {
  content: string;
}

export interface AddChatReactionRequest {
  reaction: string;
}

export interface MarkChannelReadRequest {
  lastReadMessageId?: string;
}

export interface ChatChannelReadState {
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  unreadCount: number;
}

export interface ListChatMessagesParams {
  cursor?: string;
  limit?: number;
}

// --- WebSocket contract (namespace: /chat) ---------------------------------
//
// Connect with `auth: { token: <access token> }` (or an `Authorization:
// Bearer` header). Every event name is prefixed `chat.`; the client never
// sends a write over the socket — message/reaction/channel mutations all go
// through the REST endpoints above, and the socket only carries the
// resulting broadcast plus subscribe/typing/read control messages.

export interface ChatSubscribeRequest {
  channelId: string;
  organizationId: string;
}

export interface ChatUnsubscribeRequest {
  channelId: string;
}

export interface ChatTypingRequest {
  channelId: string;
}

export interface ChatSubscribedEvent {
  channelId: string;
}

export interface ChatErrorEvent {
  code: 'UNAUTHENTICATED' | 'INVALID_REQUEST' | 'FORBIDDEN';
  channelId?: string;
}

export interface ChatAccessRevokedEvent {
  channelId: string;
}

export interface ChatTypingEvent {
  channelId: string;
  userId: string;
}

/** Client-received events, one per server emit. `chat.message.created` /
 * `.updated` / `.deleted` and `chat.reaction.updated` all carry a full
 * `ChatMessage` payload (reactions included); `chat.channel.updated`
 * carries a full `ChatChannel`. */
export interface ChatClientEvents {
  'chat.subscribed': ChatSubscribedEvent;
  'chat.error': ChatErrorEvent;
  'chat.access.revoked': ChatAccessRevokedEvent;
  'chat.message.created': ChatMessage;
  'chat.message.updated': ChatMessage;
  'chat.message.deleted': ChatMessage;
  'chat.reaction.updated': ChatMessage;
  'chat.channel.updated': ChatChannel;
  'chat.typing.started': ChatTypingEvent;
  'chat.typing.stopped': ChatTypingEvent;
}

// ---------------------------------------------------------------------------
// Direct (user-to-user) messaging — see docs/adr/0014-fellowship-chat.md's
// 2026-09-06 addendum, formally reversing that ADR's original "DMs out of
// scope" decision. Organization-scoped only (never platform-wide, even
// though usernames are globally unique); no reactions, no reply-threading,
// no dedicated read-state — see the addendum for why. Real-time delivery is
// REST + client polling, not the WebSocket gateway `ChatClientEvents` above
// is for.

export interface PersonSearchResult {
  id: string;
  displayName: string;
  /** Null until that person has set one — see
   * docs/adr/0009-administration-platform.md's addendum. Still findable by
   * display name either way; a username is a searchable handle, not a
   * hard gate on being messageable. */
  username: string | null;
}

export interface DirectConversation {
  id: string;
  organizationId: string;
  otherParticipant: PersonSearchResult;
  lastMessage: { content: string; createdAt: string; authorId: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartDirectConversationRequest {
  userId: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  authorId: string;
  authorDisplayName: string | null;
  content: string;
  createdAt: string;
}

export interface CreateDirectMessageRequest {
  content: string;
}
