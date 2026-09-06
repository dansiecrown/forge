import { useState } from 'react';
import type { ChatChannel } from '@forge/api-contract';
import type { Socket } from 'socket.io-client';
import { Hash, Megaphone, Plus } from 'lucide-react';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { useToast } from '@/components/ui/toast';
import { useActiveOrganization } from '@/contexts/organization-context';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/utils';
import { useCreateChatChannel } from '../hooks/use-chat-channels';
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
  fellowshipId: string;
  channels: ChatChannel[];
  activeChannelId: string | undefined;
  onSelect: (channel: ChatChannel) => void;
  socket: Socket | null;
  isLoading: boolean;
}

/** The "Create channel" action — visible only to a caller who actually
 * holds `chat.channel.manage` for this Fellowship (Super Admin, Org Admin,
 * or the owning Academy's Academy Admin — see
 * docs/adr/0014-fellowship-chat.md Decision 1). The backend already
 * enforced this on `POST /fellowships/:id/chat/channels`; this is purely
 * the previously-missing frontend surface for it. */
function CreateChannelAction({ fellowshipId }: { fellowshipId: string }) {
  const { activeOrganizationId } = useActiveOrganization();
  const createChannel = useCreateChatChannel(fellowshipId, activeOrganizationId);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  function close() {
    setOpen(false);
    setName('');
    setSlug('');
    setDescription('');
    createChannel.reset();
  }

  async function onSubmit() {
    try {
      await createChannel.mutateAsync({ name, slug, description: description || undefined });
      toast.success(`#${slug} created.`);
      close();
    } catch {
      // surfaced below via createChannel.error
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-1 flex items-center gap-1.5 rounded-control px-2 py-1 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        New channel
      </button>
      <Dialog open={open} onClose={close} title="Create a channel">
        <form
          className="flex flex-wrap gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
          noValidate
        >
          {createChannel.error instanceof ApiError ? (
            <Alert variant="danger" className="w-full">
              {createChannel.error.message}
            </Alert>
          ) : null}
          <FormField
            label="Name"
            name="channelName"
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FormField
            label="Slug"
            name="channelSlug"
            placeholder="lowercase-with-dashes"
            required
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
          />
          <FormField
            label="Description (optional)"
            name="channelDescription"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex w-full justify-end gap-3">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={createChannel.isPending} disabled={!name || !slug}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ChannelSidebar({
  fellowshipId,
  channels,
  activeChannelId,
  onSelect,
  socket,
  isLoading,
}: ChannelSidebarProps) {
  const permissions = usePermissions();
  return (
    <nav
      aria-label="Fellowship chat channels"
      className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-2 py-4"
    >
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Channels
      </p>
      {permissions.has('chat.channel.manage') ? (
        <CreateChannelAction fellowshipId={fellowshipId} />
      ) : null}
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
