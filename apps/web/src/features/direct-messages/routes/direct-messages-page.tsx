import { useEffect, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import type { PersonSearchResult } from '@forge/api-contract';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/portal/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { DashboardErrorPanel, DashboardState } from '@/components/dashboard-state';
import { useSession } from '@/contexts/session-context';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/utils';
import { DmPersonSearchField } from '../components/dm-person-search-field';
import {
  useConversationMessages,
  useConversations,
  useSendConversationMessage,
  useStartConversation,
} from '../hooks/use-direct-messages';

function ConversationListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

/** A minimal, purpose-built thread — not `MessageThread`/`MessageComposer`
 * (Fellowship Chat's own components), which are coupled to reactions,
 * reply-threading, and typing indicators DMs deliberately don't have. See
 * docs/adr/0014-fellowship-chat.md's 2026-09-06 addendum. */
export function DirectMessagesPage() {
  const { user } = useSession();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationsQuery = useConversations();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    searchParams.get('conversationId') ?? undefined,
  );
  const [composing, setComposing] = useState(false);
  const [newRecipient, setNewRecipient] = useState<PersonSearchResult | null>(null);
  const [draft, setDraft] = useState('');

  // A notification's "New message from…" click deep-links here with
  // `?conversationId=` — clear it once consumed so it doesn't stick around
  // if the viewer picks a different conversation afterward.
  useEffect(() => {
    if (searchParams.has('conversationId')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('conversationId');
        return next;
      });
    }
    // Deliberately empty deps — this runs once on mount to consume the
    // deep-link param, not on every searchParams change.
  }, []);

  const startConversation = useStartConversation();
  const messagesState = useConversationMessages(activeConversationId);
  const sendMessage = useSendConversationMessage(activeConversationId);

  const conversations = conversationsQuery.data ?? [];
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const status = conversationsQuery.isLoading
    ? 'loading'
    : conversationsQuery.isError
      ? 'error'
      : conversations.length === 0
        ? 'empty'
        : 'success';

  async function onStartConversation() {
    if (!newRecipient) return;
    try {
      const conversation = await startConversation.mutateAsync(newRecipient.id);
      setActiveConversationId(conversation.id);
      setComposing(false);
      setNewRecipient(null);
    } catch {
      // surfaced below via startConversation.error
    }
  }

  async function onSend() {
    const content = draft.trim();
    if (!content) return;
    try {
      await sendMessage.mutateAsync(content);
      setDraft('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send message.');
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void onSend();
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Messages"
        action={<Button onClick={() => setComposing(true)}>New message</Button>}
      />

      <div className="flex h-[calc(100vh-11rem)] min-h-[420px] overflow-hidden rounded-card border border-border bg-canvas">
        <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface">
          <DashboardState status={status}>
            <DashboardState.Loading>
              <ConversationListSkeleton />
            </DashboardState.Loading>
            <DashboardState.Error>
              <div className="p-3">
                <DashboardErrorPanel
                  description="Couldn't load your messages."
                  onRetry={() => void conversationsQuery.refetch()}
                />
              </div>
            </DashboardState.Error>
            <DashboardState.Empty>
              <div className="p-3">
                <EmptyState
                  title="No conversations yet"
                  description="Start a new message to reach someone in your organization."
                  action={<Button onClick={() => setComposing(true)}>New message</Button>}
                />
              </div>
            </DashboardState.Empty>
            <DashboardState.Content>
              <ul>
                {conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => setActiveConversationId(conversation.id)}
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors duration-150',
                          isActive ? 'bg-surface-2' : 'hover:bg-surface-2',
                        )}
                      >
                        <span className="truncate text-sm font-medium text-foreground">
                          {conversation.otherParticipant.displayName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {conversation.lastMessage?.content ?? 'No messages yet'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DashboardState.Content>
          </DashboardState>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {activeConversation ? (
            <>
              <header className="shrink-0 border-b border-border bg-surface px-4 py-2.5">
                <span className="text-sm font-semibold text-foreground">
                  {activeConversation.otherParticipant.displayName}
                </span>
                {activeConversation.otherParticipant.username ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    @{activeConversation.otherParticipant.username}
                  </span>
                ) : null}
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messagesState.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : messagesState.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
                ) : (
                  <>
                    {messagesState.hasMore ? (
                      <div className="text-center">
                        <Button variant="tertiary" onClick={messagesState.loadOlder}>
                          Load earlier messages
                        </Button>
                      </div>
                    ) : null}
                    {messagesState.rows.map((message) => {
                      const isMine = message.authorId === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}
                        >
                          <div
                            className={cn(
                              'max-w-[75%] rounded-card px-3 py-2 text-sm',
                              isMine
                                ? 'bg-foreground text-background'
                                : 'bg-surface-2 text-foreground',
                            )}
                          >
                            {message.content}
                          </div>
                          <span className="mt-0.5 text-[11px] text-muted-foreground">
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              <div className="shrink-0 border-t border-border bg-surface p-3">
                {sendMessage.error instanceof ApiError ? (
                  <Alert variant="danger" className="mb-2">
                    {sendMessage.error.message}
                  </Alert>
                ) : null}
                <div className="flex items-end gap-2">
                  <Textarea
                    aria-label="Message"
                    rows={1}
                    className="min-h-11"
                    placeholder="Write a message…"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onComposerKeyDown}
                  />
                  <Button
                    type="button"
                    aria-label="Send"
                    loading={sendMessage.isPending}
                    disabled={!draft.trim()}
                    onClick={() => void onSend()}
                  >
                    <Send className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {conversations.length === 0 ? 'Start a new message.' : 'Select a conversation.'}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={composing}
        onClose={() => {
          setComposing(false);
          setNewRecipient(null);
          startConversation.reset();
        }}
        title="New message"
      >
        <div className="space-y-4">
          {startConversation.error instanceof ApiError ? (
            <Alert variant="danger">{startConversation.error.message}</Alert>
          ) : null}
          <DmPersonSearchField
            selected={newRecipient}
            onSelect={setNewRecipient}
            onClear={() => setNewRecipient(null)}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setComposing(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={startConversation.isPending}
              disabled={!newRecipient}
              onClick={() => void onStartConversation()}
            >
              Start conversation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
