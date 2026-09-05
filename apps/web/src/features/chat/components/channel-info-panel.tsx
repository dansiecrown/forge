import type { ChatChannel } from '@forge/api-contract';
import { Hash, Lock, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TYPE_LABEL: Record<ChatChannel['type'], string> = {
  general: 'General',
  announcements: 'Announcements',
  standard: 'Standard',
};

/** The wireframe's third column. A full member roster needs a fellowship
 * membership listing this feature deliberately doesn't add (no
 * FellowshipMembership table — see docs/adr/0014-fellowship-chat.md
 * Decision 1); this panel sticks to what the channel itself already
 * describes, keeping the three-column layout without inventing new
 * backend surface area for a V1 that doesn't call for a roster. */
export function ChannelInfoPanel({ channel }: { channel: ChatChannel }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-surface px-4 py-5 lg:flex">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {channel.type === 'announcements' ? (
            <Megaphone className="size-4" aria-hidden="true" />
          ) : (
            <Hash className="size-4" aria-hidden="true" />
          )}
          {channel.name}
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
      </div>

      <div className="border-t border-border pt-3 text-xs text-muted-foreground">
        Everyone enrolled or assigned to this Fellowship can see this channel
        {channel.isPrivate ? ', once added as a member.' : '.'}
      </div>
    </aside>
  );
}
