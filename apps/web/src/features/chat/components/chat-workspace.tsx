import { useEffect, useState } from 'react';
import type { ChatChannel, ChatMessage } from '@forge/api-contract';
import { Info, Menu, X } from 'lucide-react';
import { useSession } from '@/contexts/session-context';
import { useActiveOrganization } from '@/contexts/organization-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { useChatSocket } from '../hooks/use-chat-socket';
import { useChatChannels, useChatChannelsLiveRefresh } from '../hooks/use-chat-channels';
import { useChatMessages } from '../hooks/use-chat-messages';
import { useChatReadState, useResetChatReadState } from '../hooks/use-chat-read-state';
import { useTypingIndicator } from '../hooks/use-typing-indicator';
import { ChannelSidebar } from './channel-sidebar';
import { ChannelInfoPanel } from './channel-info-panel';
import { MessageThread } from './message-thread';
import { MessageComposer } from './message-composer';
import { ConnectionStatus } from './connection-status';

/** The Fellowship Chat workspace — Channels | Messages | Members, per
 * Phase 10's wireframe. Mounted once per role at `/portal/chat` and
 * `/mentor/chat` with the caller's own Fellowship already resolved (never
 * from a route param), and reused as-is: nothing here is student- or
 * mentor-specific. */
export function ChatWorkspace({ fellowshipId }: { fellowshipId: string }) {
  const { user } = useSession();
  const { activeOrganizationId } = useActiveOrganization();
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [channelDrawerOpen, setChannelDrawerOpen] = useState(false);
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);

  const channelsQuery = useChatChannels(fellowshipId, activeOrganizationId);
  const { socket, status, subscribed, subscribeError } = useChatSocket(
    activeOrganizationId,
    activeChannel?.id,
  );
  useChatChannelsLiveRefresh(socket, fellowshipId);

  const channels = channelsQuery.data ?? [];
  useEffect(() => {
    if (!activeChannel && channels.length > 0) {
      setActiveChannel(channels.find((c) => c.type === 'general') ?? channels[0]);
    }
  }, [channels, activeChannel]);

  const messagesState = useChatMessages(
    activeChannel?.id,
    activeOrganizationId,
    socket,
    subscribed,
  );
  const readState = useChatReadState(activeChannel?.id, socket);
  const resetReadState = useResetChatReadState();
  const { typingUserIds, notifyTyping, notifyStopped } = useTypingIndicator(
    socket,
    activeChannel?.id,
    user?.id ?? '',
  );

  function handleReachedLatest() {
    if (!activeChannel) return;
    const latest = messagesState.messages[messagesState.messages.length - 1];
    if (!latest) return;
    if (readState.data && readState.data.lastReadMessageId === latest.id) return;
    messagesState.markRead(latest.id);
    resetReadState(activeChannel.id, latest.id);
  }

  const typingLabel = (() => {
    if (typingUserIds.length === 0) return null;
    const names = typingUserIds
      .map((id) => {
        for (let i = messagesState.messages.length - 1; i >= 0; i -= 1) {
          const candidate = messagesState.messages[i];
          if (candidate.authorId === id) return candidate.authorDisplayName;
        }
        return null;
      })
      .filter((name): name is string => Boolean(name));
    if (names.length === 0) return 'Someone is typing…';
    if (names.length === 1) return `${names[0]} is typing…`;
    return `${names.join(', ')} are typing…`;
  })();

  if (channelsQuery.isError) {
    return (
      <Alert variant="danger">
        Couldn't load this Fellowship's chat. Please try again shortly.
      </Alert>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[420px] overflow-hidden rounded-card border border-border bg-canvas md:h-[calc(100vh-9rem)]">
      {/* Desktop channel sidebar */}
      <div className="hidden md:flex">
        <ChannelSidebar
          channels={channels}
          activeChannelId={activeChannel?.id}
          onSelect={(channel) => {
            setActiveChannel(channel);
            setReplyTo(null);
          }}
          socket={socket}
          isLoading={channelsQuery.isLoading}
        />
      </div>

      {/* Mobile channel drawer */}
      {channelDrawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close channel list"
            className="absolute inset-0 bg-canvas/70"
            onClick={() => setChannelDrawerOpen(false)}
          />
          <div className="relative h-full w-64">
            <ChannelSidebar
              channels={channels}
              activeChannelId={activeChannel?.id}
              onSelect={(channel) => {
                setActiveChannel(channel);
                setReplyTo(null);
                setChannelDrawerOpen(false);
              }}
              socket={socket}
              isLoading={channelsQuery.isLoading}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open channel list"
              onClick={() => setChannelDrawerOpen(true)}
              className="text-muted-foreground hover:text-foreground md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            {activeChannel ? (
              <span className="truncate text-sm font-semibold text-foreground">
                #{activeChannel.name}
              </span>
            ) : (
              <Skeleton className="h-4 w-24" />
            )}
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus status={status} />
            <button
              type="button"
              aria-label="Channel info"
              onClick={() => setInfoDrawerOpen(true)}
              className="text-muted-foreground hover:text-foreground lg:hidden"
            >
              <Info className="size-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {activeChannel ? (
          <>
            <MessageThread
              channel={activeChannel}
              messages={messagesState.messages}
              pending={messagesState.pending}
              currentUserId={user?.id ?? ''}
              isLoading={messagesState.isLoading}
              isError={messagesState.isError}
              hasOlder={messagesState.hasOlder}
              isFetchingOlder={messagesState.isFetchingOlder}
              onLoadOlder={() => void messagesState.fetchOlder()}
              unreadBoundaryMessageId={readState.data?.lastReadMessageId ?? null}
              hasUnread={Boolean(readState.data && readState.data.unreadCount > 0)}
              typingLabel={typingLabel}
              onReply={setReplyTo}
              onEdit={messagesState.editMessage}
              onDelete={messagesState.deleteMessage}
              onToggleReaction={(message, reaction) =>
                void messagesState.toggleReaction(message, reaction, user?.id ?? '')
              }
              onRetryPending={messagesState.retryPending}
              onDismissPending={messagesState.dismissPending}
              onReachedLatest={handleReachedLatest}
            />
            <MessageComposer
              disabled={Boolean(activeChannel.archivedAt) || subscribeError?.code === 'FORBIDDEN'}
              disabledReason={
                activeChannel.archivedAt
                  ? 'This channel is archived.'
                  : subscribeError?.code === 'FORBIDDEN'
                    ? "You don't have access to this channel."
                    : undefined
              }
              channelName={activeChannel.name}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSend={messagesState.sendMessage}
              onTyping={notifyTyping}
              onStoppedTyping={notifyStopped}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {channelsQuery.isLoading ? 'Loading channels…' : 'No channel selected.'}
          </div>
        )}
      </div>

      {activeChannel ? (
        <div className="hidden lg:flex">
          <ChannelInfoPanel channel={activeChannel} />
        </div>
      ) : null}

      {infoDrawerOpen && activeChannel ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close channel info"
            className="absolute inset-0 bg-canvas/70"
            onClick={() => setInfoDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-64">
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Channel info</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setInfoDrawerOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <ChannelInfoPanel channel={activeChannel} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
