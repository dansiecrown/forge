import { useEffect, useRef, useState } from 'react';
import type { ChatChannel, ChatMessage } from '@forge/api-contract';
import { AlertCircle, ArrowDown, Loader2, RotateCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDaySeparator } from '../utils/format-time';
import type { PendingMessage } from '../hooks/use-chat-messages';
import { MessageItem } from './message-item';

const NEAR_BOTTOM_THRESHOLD_PX = 120;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

interface MessageThreadProps {
  channel: ChatChannel;
  messages: ChatMessage[];
  pending: PendingMessage[];
  currentUserId: string;
  isLoading: boolean;
  isError: boolean;
  hasOlder: boolean | undefined;
  isFetchingOlder: boolean;
  onLoadOlder: () => void;
  unreadBoundaryMessageId: string | null;
  hasUnread: boolean;
  typingLabel: string | null;
  onReply: (message: ChatMessage) => void;
  onEdit: (messageId: string, content: string) => Promise<unknown>;
  onDelete: (messageId: string) => Promise<unknown>;
  onToggleReaction: (message: ChatMessage, reaction: string) => void;
  onRetryPending: (tempId: string) => void;
  onDismissPending: (tempId: string) => void;
  onReachedLatest: () => void;
}

function shouldShowHeader(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  const prev = messages[index - 1];
  const current = messages[index];
  if (prev.authorId !== current.authorId) return true;
  return (
    new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_WINDOW_MS
  );
}

export function MessageThread({
  channel,
  messages,
  pending,
  currentUserId,
  isLoading,
  isError,
  hasOlder,
  isFetchingOlder,
  onLoadOlder,
  unreadBoundaryMessageId,
  hasUnread,
  typingLabel,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onRetryPending,
  onDismissPending,
  onReachedLatest,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const previousLastId = useRef<string | null>(null);
  const previousChannelId = useRef<string | null>(null);

  // New message arrives (or the channel changes): auto-scroll to bottom
  // only if the reader was already there — never yank someone reading
  // scrollback down to a new message.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const lastId = messages[messages.length - 1]?.id ?? null;
    const channelChanged = previousChannelId.current !== channel.id;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const wasNearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;

    if (channelChanged) {
      container.scrollTop = container.scrollHeight;
      onReachedLatest();
    } else if (lastId !== previousLastId.current && wasNearBottom) {
      container.scrollTop = container.scrollHeight;
      onReachedLatest();
    }

    previousLastId.current = lastId;
    previousChannelId.current = channel.id;
    // Intentionally keyed on message identity/channel, not `onReachedLatest`
    // itself — that callback closes over state that changes far more often
    // than "did the message list or active channel actually change".
  }, [messages, channel.id]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowJumpToLatest(distanceFromBottom > NEAR_BOTTOM_THRESHOLD_PX);
    if (distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX) onReachedLatest();
    if (container.scrollTop < 80 && hasOlder && !isFetchingOlder) onLoadOlder();
  }

  function jumpToLatest() {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    onReachedLatest();
  }

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
        <AlertCircle className="size-6 text-danger" aria-hidden="true" />
        Couldn't load messages for this channel.
      </div>
    );
  }

  let dayCursor = '';
  let unreadShown = false;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-4"
        aria-label={`Messages in #${channel.name}`}
      >
        {hasOlder ? (
          <div className="flex justify-center pb-3">
            {isFetchingOlder ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : (
              <button
                type="button"
                onClick={onLoadOlder}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Load earlier messages
              </button>
            )}
          </div>
        ) : null}

        {messages.length === 0 && pending.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">#{channel.name} is quiet so far</p>
            <p>Be the first to say something.</p>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const dayLabel = formatDaySeparator(message.createdAt);
          const showDaySeparator = dayLabel !== dayCursor;
          if (showDaySeparator) dayCursor = dayLabel;

          const showUnreadSeparator =
            hasUnread && !unreadShown && unreadBoundaryMessageId !== null
              ? message.id === unreadBoundaryMessageId
              : false;
          if (showUnreadSeparator) unreadShown = true;

          return (
            <div key={message.id}>
              {showDaySeparator ? (
                <div className="my-4 flex items-center gap-3" role="separator">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground">{dayLabel}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              ) : null}
              {showUnreadSeparator ? (
                <div
                  className="my-3 flex items-center gap-3"
                  role="separator"
                  aria-label="Unread messages"
                >
                  <div className="h-px flex-1 bg-danger/40" />
                  <span className="text-xs font-medium text-danger">New</span>
                  <div className="h-px flex-1 bg-danger/40" />
                </div>
              ) : null}
              <MessageItem
                message={message}
                currentUserId={currentUserId}
                showHeader={shouldShowHeader(messages, index)}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleReaction={onToggleReaction}
              />
            </div>
          );
        })}

        {pending.map((item) => (
          <div key={item.tempId} className="mt-2 flex items-start gap-3 px-2 opacity-70">
            <div className="w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                {item.content}
              </p>
              {item.status === 'sending' ? (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Sending…
                </span>
              ) : (
                <span className="mt-0.5 flex items-center gap-2 text-xs text-danger">
                  <AlertCircle className="size-3" aria-hidden="true" /> Failed to send
                  <button
                    type="button"
                    onClick={() => onRetryPending(item.tempId)}
                    className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                  >
                    <RotateCw className="size-3" aria-hidden="true" /> Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissPending(item.tempId)}
                    className="font-medium underline underline-offset-2"
                  >
                    Dismiss
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}

        {typingLabel ? (
          <p className="mt-2 px-2 text-xs italic text-muted-foreground" aria-live="polite">
            {typingLabel}
          </p>
        ) : null}
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-subtle hover:bg-surface-2"
        >
          <ArrowDown className="size-3.5" aria-hidden="true" />
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
