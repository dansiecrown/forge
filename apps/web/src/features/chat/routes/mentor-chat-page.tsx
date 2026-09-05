import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { useMentorFellowshipId } from '../hooks/use-fellowship-id';
import { ChatWorkspace } from '../components/chat-workspace';

/** Scoped to the mentor's currently-selected cohort (the same selection
 * `MentorContext` already drives the roster/huddle pages with) — a mentor
 * assigned to cohorts across more than one Fellowship switches which one's
 * chat they see the same way they already switch cohorts elsewhere in the
 * mentor portal, rather than this page inventing a second selector. */
export function MentorChatPage() {
  const { fellowshipId, isLoading } = useMentorFellowshipId();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!fellowshipId) {
    return (
      <Alert variant="danger">
        You don't have an active cohort assignment yet, so there's no chat to show.
      </Alert>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-foreground">Fellowship Chat</h1>
      <ChatWorkspace fellowshipId={fellowshipId} />
    </div>
  );
}
