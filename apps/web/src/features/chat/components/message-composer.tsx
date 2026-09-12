import { useState, type KeyboardEvent } from 'react';
import type { ChatMessage } from '@forge/api-contract';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageComposerProps {
  disabled: boolean;
  disabledReason?: string;
  channelName: string;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSend: (content: string, replyToMessageId?: string) => void;
  onTyping?: () => void;
  onStoppedTyping?: () => void;
}

/** Plain-text composer — no rich-text editor (Phase 10: "a large rich-text
 * editor is not needed"). Enter sends, Shift+Enter inserts a newline. */
export function MessageComposer({
  disabled,
  disabledReason,
  channelName,
  replyTo,
  onCancelReply,
  onSend,
  onTyping,
  onStoppedTyping,
}: MessageComposerProps) {
  const [value, setValue] = useState('');

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, replyTo?.id);
    setValue('');
    onCancelReply();
    onStoppedTyping?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      {replyTo ? (
        <div className="mb-2 flex items-center justify-between rounded-control border-l-2 border-brand/40 bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="truncate">
            Replying to <span className="font-medium">{replyTo.authorDisplayName}</span>:{' '}
            {replyTo.content}
          </span>
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={onCancelReply}
            className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value.trim().length > 0) onTyping?.();
            else onStoppedTyping?.();
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled ? (disabledReason ?? "You can't post here.") : `Message #${channelName}`
          }
          aria-label="Message"
          className="min-h-11 flex-1 resize-none"
          rows={1}
        />
        <Button
          type="button"
          onClick={submit}
          disabled={disabled || value.trim().length === 0}
          aria-label="Send message"
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
