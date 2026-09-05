import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { useStudentFellowshipId } from '../hooks/use-fellowship-id';
import { ChatWorkspace } from '../components/chat-workspace';

export function StudentChatPage() {
  const { fellowshipId, isLoading } = useStudentFellowshipId();

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
        You're not currently enrolled in a Fellowship, so there's no chat to show yet.
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
