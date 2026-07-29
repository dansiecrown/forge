import { Loader2, Copy, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/portal/empty-state';
import { usePortfolioProjectActions, usePortfolioProjects } from '../hooks/use-portfolio';

export function PortfolioPage() {
  const { data: projects, isLoading, error } = usePortfolioProjects();

  return (
    <div>
      <AdminPageHeader
        title="Portfolio"
        description="Showcase your completed practical work."
        action={
          <Link to="/portal/portfolio/new" className={buttonVariants({ variant: 'primary' })}>
            New project
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : error || !projects ? (
        <EmptyState title="We couldn't load your portfolio." />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No portfolio projects yet"
          description="Submit a practical task, then feature it here."
          action={
            <Link to="/portal/portfolio/new" className={buttonVariants({ variant: 'secondary' })}>
              Create your first project
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <PortfolioCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function PortfolioCard({
  project,
}: {
  project: NonNullable<ReturnType<typeof usePortfolioProjects>['data']>[number];
}) {
  const { publish, unpublish } = usePortfolioProjectActions(project.id);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-medium text-foreground">{project.title}</p>
          {project.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
          ) : null}
        </div>
        <Badge tone={project.visibility === 'public' ? 'success' : 'neutral'}>
          {project.visibility}
        </Badge>
      </div>

      {project.technologies.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {project.technologies.map((tech) => (
            <Badge key={tech} tone="brand">
              {tech}
            </Badge>
          ))}
        </div>
      ) : null}

      {project.visibility === 'public' && project.publicSlug ? (
        <div className="flex items-center gap-1.5 rounded-control border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="truncate">{`forge.example/p/${project.publicSlug}`}</span>
          <button
            type="button"
            aria-label="Copy public link"
            onClick={() =>
              void navigator.clipboard?.writeText(`https://forge.example/p/${project.publicSlug}`)
            }
            className="ml-auto shrink-0 hover:text-foreground"
          >
            <Copy className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {project.visibility === 'public' ? (
        <p className="text-xs text-muted-foreground">(preview only — public link not yet live)</p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <Link
          to={`/portal/portfolio/${project.id}`}
          className={buttonVariants({ variant: 'secondary' })}
        >
          Edit
        </Link>
        {project.visibility === 'private' ? (
          <Button
            variant="tertiary"
            loading={publish.isPending}
            onClick={() => publish.mutate(project.version)}
          >
            Publish
          </Button>
        ) : (
          <Button
            variant="tertiary"
            loading={unpublish.isPending}
            onClick={() => unpublish.mutate(project.version)}
          >
            Unpublish
          </Button>
        )}
        {project.repositoryUrl ? (
          <a
            href={project.repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            Repo <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </Card>
  );
}
