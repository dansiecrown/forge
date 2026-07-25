import { Button } from '@/components/ui/button';

/** Cursor-pagination footer — the API returns opaque `nextCursor`/`hasMore`
 * (docs/api-specification.md §2), so "load more" (append) is the natural
 * pattern rather than numbered pages. */
export function LoadMore({
  hasMore,
  isLoading,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Button variant="secondary" onClick={onLoadMore} loading={isLoading}>
        Load more
      </Button>
    </div>
  );
}
