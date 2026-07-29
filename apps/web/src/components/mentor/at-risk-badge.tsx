import { Badge } from '@/components/ui/badge';

/** Label + inline reason, never a bare score — see
 * docs/adr/0008-mentor-experience.md Decision 6. Renders nothing when the
 * student isn't flagged. */
export function AtRiskBadge({ atRisk, reason }: { atRisk: boolean; reason: string | null }) {
  if (!atRisk) {
    return null;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <Badge tone="warning">At risk</Badge>
      {reason ? <span className="text-xs text-muted-foreground">{reason}</span> : null}
    </div>
  );
}
