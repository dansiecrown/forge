import { useState } from 'react';
import { Loader2, Bookmark, BookmarkCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { EmptyState } from '@/components/portal/empty-state';
import {
  useAcknowledgeResource,
  useLearningResources,
  useToggleBookmark,
} from '@/features/student-curriculum/hooks/use-student-curriculum';

const TYPE_OPTIONS = [
  { value: 'udemy_course', label: 'Udemy course' },
  { value: 'youtube_video', label: 'YouTube video' },
  { value: 'official_documentation', label: 'Documentation' },
  { value: 'github_repository', label: 'GitHub repository' },
  { value: 'pdf', label: 'PDF' },
  { value: 'article', label: 'Article' },
  { value: 'book', label: 'Book' },
  { value: 'other', label: 'Other' },
];

export function LearningResourcesPortalPage() {
  const [q, setQ] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const {
    data: resources,
    isLoading,
    error,
  } = useLearningResources({
    q: q || undefined,
    resourceType: resourceType || undefined,
    bookmarked: bookmarkedOnly || undefined,
  });
  const { add, remove } = useToggleBookmark();
  const acknowledge = useAcknowledgeResource();

  return (
    <div>
      <AdminPageHeader
        title="Learning Resources"
        description="Every resource across your current and completed weeks."
      />

      <ListToolbar
        q={q}
        onQChange={setQ}
        status={resourceType}
        onStatusChange={setResourceType}
        statusOptions={TYPE_OPTIONS}
        searchPlaceholder="Search resources…"
      />
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={bookmarkedOnly ? 'secondary' : 'tertiary'}
          onClick={() => setBookmarkedOnly((prev) => !prev)}
        >
          {bookmarkedOnly ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          Bookmarked only
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : error || !resources ? (
        <EmptyState title="We couldn't load your resources." />
      ) : resources.length === 0 ? (
        <EmptyState
          title={bookmarkedOnly ? 'No bookmarks yet' : 'No resources found'}
          description={
            bookmarkedOnly
              ? 'Bookmark a resource from a weekly module to see it here.'
              : 'Try a different search or filter.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {resources.map((resource) => (
            <Card key={resource.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {resource.resourceType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-base font-medium text-foreground">{resource.title}</p>
                  {resource.provider ? (
                    <p className="text-sm text-muted-foreground">{resource.provider}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={resource.bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                  onClick={() =>
                    resource.bookmarked ? remove.mutate(resource.id) : add.mutate(resource.id)
                  }
                  className="shrink-0 text-muted-foreground hover:text-brand"
                >
                  {resource.bookmarked ? (
                    <BookmarkCheck className="size-5 fill-current text-brand" aria-hidden="true" />
                  ) : (
                    <Bookmark className="size-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                {resource.isRequired ? <Badge tone="neutral">required</Badge> : null}
                {resource.acknowledged ? (
                  <Badge tone="success">
                    <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
                    Done
                  </Badge>
                ) : null}
                {resource.url ? (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
                  >
                    Open <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : null}
                {!resource.acknowledged ? (
                  <Button
                    variant="tertiary"
                    className="ml-auto"
                    loading={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(resource.id)}
                  >
                    Mark complete
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
