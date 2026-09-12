import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatChannel } from '@forge/api-contract';
import { GraduationCap, Hash, Lock, Megaphone, MessageSquare, Pencil } from 'lucide-react';
import { ApiError, describeApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { TextareaField } from '@/components/textarea-field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useSession } from '@/contexts/session-context';
import {
  messagesPathFor,
  type NotificationRole,
} from '@/features/notifications/utils/resolve-notification-target';
import { useStartConversation } from '@/features/direct-messages/hooks/use-direct-messages';
import { useChatChannelMembers } from '../hooks/use-chat-channel-members';
import {
  useArchiveChatChannel,
  useRestoreChatChannel,
  useUpdateChatChannel,
} from '../hooks/use-chat-channels';

const TYPE_LABEL: Record<ChatChannel['type'], string> = {
  general: 'General',
  announcements: 'Announcements',
  standard: 'Standard',
  track: 'Track',
};

/** The wireframe's third column. Rename and archive/restore are
 * `chat.channel.manage`-only — hidden entirely for anyone else, enforced
 * server-side either way. `canManageChannels` comes from the channel list
 * response (per-Fellowship, not a static role-permission check — see
 * docs/adr/0014-fellowship-chat.md's 2026-09-12 addendum), so an Academy
 * Admin viewing a Fellowship outside their academy correctly sees no
 * edit/archive action instead of one that would 403 on click. The member
 * roster below is visible to every participant — see `MembersList`'s own
 * doc comment. */
export function ChannelInfoPanel({
  fellowshipId,
  channel,
  role,
  canManageChannels,
  onChannelUpdated,
}: {
  fellowshipId: string;
  channel: ChatChannel;
  role: NotificationRole;
  canManageChannels: boolean;
  onChannelUpdated: (channel: ChatChannel) => void;
}) {
  const { activeOrganizationId } = useActiveOrganization();
  const toast = useToast();
  const updateChannel = useUpdateChatChannel(fellowshipId, activeOrganizationId);
  const archiveChannel = useArchiveChatChannel(fellowshipId, activeOrganizationId);
  const restoreChannel = useRestoreChatChannel(fellowshipId, activeOrganizationId);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? '');
  const [confirmingTransition, setConfirmingTransition] = useState(false);

  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description ?? '');
  }, [channel.id, channel.name, channel.description]);

  const canManage = canManageChannels;
  const isArchived = Boolean(channel.archivedAt);

  async function onSaveEdit() {
    try {
      const updated = await updateChannel.mutateAsync({
        channelId: channel.id,
        body: { name, description: description || undefined },
        version: channel.version,
      });
      onChannelUpdated(updated);
      toast.success('Channel updated.');
      setEditOpen(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? describeApiError(err, err.message) : 'Failed to update channel.',
      );
    }
  }

  async function onConfirmTransition() {
    try {
      const updated = isArchived
        ? await restoreChannel.mutateAsync({
            channelId: channel.id,
            body: { version: channel.version },
          })
        : await archiveChannel.mutateAsync({
            channelId: channel.id,
            body: { version: channel.version },
          });
      onChannelUpdated(updated);
      toast.success(isArchived ? 'Channel restored.' : 'Channel archived.');
      setConfirmingTransition(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? describeApiError(err, err.message) : 'Failed to update channel.',
      );
    }
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-surface px-4 py-5 lg:flex">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {channel.type === 'announcements' ? (
              <Megaphone className="size-4 shrink-0" aria-hidden="true" />
            ) : channel.type === 'track' ? (
              <GraduationCap className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Hash className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{channel.name}</span>
          </div>
          {canManage ? (
            <button
              type="button"
              aria-label="Edit channel"
              onClick={() => setEditOpen(true)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {channel.description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{channel.description}</p>
        ) : (
          <p className="mt-1.5 text-sm italic text-muted-foreground">No description.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="neutral">{TYPE_LABEL[channel.type]}</Badge>
        {channel.isPrivate ? (
          <Badge tone="warning">
            <Lock className="mr-1 size-3" aria-hidden="true" />
            Private
          </Badge>
        ) : null}
        {isArchived ? <Badge tone="danger">Archived</Badge> : null}
      </div>

      <div className="border-t border-border pt-3 text-xs text-muted-foreground">
        Everyone enrolled or assigned to this Fellowship can see this channel
        {channel.isPrivate ? ', once added as a member.' : '.'}
      </div>

      <MembersList channelId={channel.id} role={role} />

      {canManage ? (
        <div className="border-t border-border pt-3">
          <Button
            variant={isArchived ? 'primary' : 'destructive'}
            className="w-full"
            onClick={() => setConfirmingTransition(true)}
          >
            {isArchived ? 'Restore channel' : 'Archive channel'}
          </Button>
        </div>
      ) : null}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit channel">
        <form
          className="flex flex-wrap gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSaveEdit();
          }}
          noValidate
        >
          {updateChannel.error instanceof ApiError ? (
            <Alert variant="danger" className="w-full">
              {describeApiError(updateChannel.error, updateChannel.error.message)}
            </Alert>
          ) : null}
          <FormField
            label="Name"
            name="editChannelName"
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextareaField
            label="Description"
            name="editChannelDescription"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex w-full justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateChannel.isPending} disabled={!name}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmingTransition}
        onClose={() => setConfirmingTransition(false)}
        onConfirm={onConfirmTransition}
        loading={archiveChannel.isPending || restoreChannel.isPending}
        error={
          archiveChannel.error instanceof ApiError
            ? describeApiError(archiveChannel.error, archiveChannel.error.message)
            : restoreChannel.error instanceof ApiError
              ? describeApiError(restoreChannel.error, restoreChannel.error.message)
              : null
        }
        title={isArchived ? 'Restore this channel?' : 'Archive this channel?'}
        description={
          isArchived
            ? 'Members will be able to post in it again.'
            : "Members won't be able to post in it until it's restored. Existing messages stay visible."
        }
        confirmLabel={isArchived ? 'Restore' : 'Archive'}
        confirmVariant={isArchived ? 'primary' : 'destructive'}
      />
    </aside>
  );
}

/** The "start a conversation directly with them" roster — visible to any
 * participant with read access to this channel (not just managers), backed
 * by `FellowshipChatChannelMember` rows `ChatMembershipSyncService` keeps in
 * sync with Enrollment status for students (see that service's own doc
 * comment). Mentors and admins aren't in this list yet — a disclosed scope
 * limitation, not a bug. Clicking a member starts (or resumes) a DM and
 * deep-links straight to it, exactly like a `dm.message.received`
 * notification's own deep link does. */
function MembersList({ channelId, role }: { channelId: string; role: NotificationRole }) {
  const { user } = useSession();
  const { activeOrganizationId } = useActiveOrganization();
  const navigate = useNavigate();
  const toast = useToast();
  const membersQuery = useChatChannelMembers(channelId, activeOrganizationId);
  const startConversation = useStartConversation();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const members = (membersQuery.data ?? []).filter((member) => member.id !== user?.id);

  async function onMessage(memberId: string) {
    setPendingId(memberId);
    try {
      const conversation = await startConversation.mutateAsync(memberId);
      navigate(`${messagesPathFor(role)}?conversationId=${conversation.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? describeApiError(err, err.message)
          : 'Failed to start conversation.',
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="border-t border-border pt-3">
      <h3 className="text-sm font-semibold text-foreground">Members</h3>
      <div className="mt-2 space-y-1">
        {membersQuery.isLoading ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </>
        ) : membersQuery.isError ? (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Couldn't load members.</span>
            <Button variant="tertiary" onClick={() => void membersQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : members.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">No one else here yet.</p>
        ) : (
          members.map((member) => (
            <button
              key={member.id}
              type="button"
              disabled={startConversation.isPending && pendingId === member.id}
              onClick={() => void onMessage(member.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors duration-200 ease-in-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              <span className="truncate">{member.displayName}</span>
              <MessageSquare
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
