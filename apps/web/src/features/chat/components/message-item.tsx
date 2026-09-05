import { useState } from 'react';
import type { ChatMessage } from '@forge/api-contract';
import { Check, Pencil, Reply, SmilePlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils';
import { formatMessageTime } from '../utils/format-time';

const QUICK_REACTIONS = ['👍', '🎉', '❤️', '👀', '🙌'];

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  showHeader: boolean;
  onReply: (message: ChatMessage) => void;
  onEdit: (messageId: string, content: string) => Promise<unknown>;
  onDelete: (messageId: string) => Promise<unknown>;
  onToggleReaction: (message: ChatMessage, reaction: string) => void;
}

export function MessageItem({
  message,
  currentUserId,
  showHeader,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isOwn = message.authorId === currentUserId;
  const isDeleted = Boolean(message.deletedAt);

  const reactionCounts = new Map<string, { count: number; mine: boolean }>();
  for (const r of message.reactions) {
    const entry = reactionCounts.get(r.reaction) ?? { count: 0, mine: false };
    entry.count += 1;
    if (r.userId === currentUserId) entry.mine = true;
    reactionCounts.set(r.reaction, entry);
  }

  async function submitEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      return;
    }
    await onEdit(message.id, trimmed);
    setEditing(false);
  }

  return (
    <div
      className={cn(
        'group relative flex gap-3 rounded-control px-2 py-1 hover:bg-surface-2/60',
        showHeader ? 'mt-3' : 'mt-0.5',
      )}
    >
      <div className="w-8 shrink-0">
        {showHeader ? (
          <div
            className="flex size-8 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand"
            aria-hidden="true"
          >
            {initials(message.authorDisplayName)}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        {showHeader ? (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-foreground">
              {message.authorDisplayName ?? 'Unknown'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
        ) : null}

        {message.replyToPreview ? (
          <div className="mb-1 flex items-center gap-1.5 rounded-control border-l-2 border-brand/40 bg-surface-2/70 px-2 py-1 text-xs text-muted-foreground">
            <Reply className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              <span className="font-medium">{message.replyToPreview.authorDisplayName}:</span>{' '}
              {message.replyToPreview.content}
            </span>
          </div>
        ) : null}

        {isDeleted ? (
          <p className="text-sm italic text-muted-foreground">Message deleted</p>
        ) : editing ? (
          <div className="space-y-1.5">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submitEdit();
                }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="min-h-16"
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => void submitEdit()}>
                <Check className="size-3.5" aria-hidden="true" /> Save
              </Button>
              <Button type="button" variant="tertiary" onClick={() => setEditing(false)}>
                <X className="size-3.5" aria-hidden="true" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {message.content}
            {message.editedAt ? (
              <span className="ml-1.5 text-xs text-muted-foreground">(edited)</span>
            ) : null}
          </p>
        )}

        {reactionCounts.size > 0 && !isDeleted ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {[...reactionCounts.entries()].map(([reaction, { count, mine }]) => (
              <button
                key={reaction}
                type="button"
                onClick={() => onToggleReaction(message, reaction)}
                aria-pressed={mine}
                aria-label={`React with ${reaction} (${count})`}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                  mine
                    ? 'border-brand/40 bg-brand/10 text-brand'
                    : 'border-border bg-surface-2 text-muted-foreground hover:border-muted-foreground/50',
                )}
              >
                <span>{reaction}</span>
                <span>{count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!isDeleted ? (
        <div className="absolute right-2 top-0 hidden items-center gap-0.5 rounded-control border border-border bg-surface px-1 py-0.5 shadow-subtle group-hover:flex group-focus-within:flex">
          <div className="relative">
            <button
              type="button"
              aria-label="Add reaction"
              onClick={() => setPickerOpen((v) => !v)}
              className="flex size-7 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <SmilePlus className="size-3.5" aria-hidden="true" />
            </button>
            {pickerOpen ? (
              <div className="absolute right-0 top-8 z-10 flex gap-1 rounded-control border border-border bg-surface p-1.5 shadow-subtle">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex size-7 items-center justify-center rounded-control text-base hover:bg-surface-2"
                    onClick={() => {
                      onToggleReaction(message, emoji);
                      setPickerOpen(false);
                    }}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Reply"
            onClick={() => onReply(message)}
            className="flex size-7 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <Reply className="size-3.5" aria-hidden="true" />
          </button>
          {isOwn ? (
            <>
              <button
                type="button"
                aria-label="Edit message"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                className="flex size-7 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
              {confirmingDelete ? (
                <>
                  <button
                    type="button"
                    aria-label="Confirm delete"
                    onClick={() => {
                      void onDelete(message.id);
                      setConfirmingDelete(false);
                    }}
                    className="flex size-7 items-center justify-center rounded-control text-danger hover:bg-danger/10"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel delete"
                    onClick={() => setConfirmingDelete(false)}
                    className="flex size-7 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-2"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label="Delete message"
                  onClick={() => setConfirmingDelete(true)}
                  className="flex size-7 items-center justify-center rounded-control text-muted-foreground hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
