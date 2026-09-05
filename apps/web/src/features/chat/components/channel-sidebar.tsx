import type { ChatChannel } from '@forge/api-contract';
import type { Socket } from 'socket.io-client';
import { Hash, Megaphone } from 'lucide-react';
import { cn } from '@/utils';
import { useChatReadState } from '../hooks/use-chat-read-state';

function ChannelIcon({ type }: { type: ChatChannel['type'] }) {
  if (type === 'announcements') return <Megaphone className="size-4" aria-hidden="true" />;
  return <Hash className="size-4" aria-hidden="true" />;
}

function UnreadBadge({ channelId, socket }: { channelId: string; socket: Socket | null }) {
  const { data } = useChatReadState(channelId, socket);
  if (!data || data.unreadCount === 0) return null;
  return (
    <span
      className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white"
      aria-label={`${data.unreadCount} unread`}
    >
      {data.unreadCount > 99 ? '99+' : data.unreadCount}
    </span>
  );
}

interface ChannelSidebarProps {
  channels: ChatChannel[];
  activeChannelId: string | undefined;
  onSelect: (channel: ChatChannel) => void;
  socket: Socket | null;
  isLoading: boolean;
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  onSelect,
  socket,
  isLoading,
}: ChannelSidebarProps) {
  return (
    <nav
      aria-label="Fellowship chat channels"
      className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-2 py-4"
    >
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Channels
      </p>
      {isLoading ? (
        <p className="px-2 text-sm text-muted-foreground">Loading…</p>
      ) : channels.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">No channels yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {channels
            .filter((c) => !c.archivedAt)
            .map((channel) => {
              const isActive = channel.id === activeChannelId;
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(channel)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-surface-2 text-foreground'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                    )}
                  >
                    <ChannelIcon type={channel.type} />
                    <span className="truncate">{channel.name}</span>
                    {!isActive ? <UnreadBadge channelId={channel.id} socket={socket} /> : null}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </nav>
  );
}
