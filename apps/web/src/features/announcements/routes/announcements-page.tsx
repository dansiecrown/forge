import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Announcement } from '@forge/api-contract';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  archiveAnnouncement,
  createAnnouncement,
  listAnnouncements,
  publishAnnouncement,
} from '../api/announcements-api';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

export function AnnouncementsPage() {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'organization' | 'academy' | 'cohort' | 'platform'>(
    'organization',
  );
  const [academyId, setAcademyId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['announcements', activeOrganizationId],
    queryFn: () => listAnnouncements(activeOrganizationId as string),
    enabled: Boolean(activeOrganizationId),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['announcements'] });
  const create = useMutation({
    mutationFn: () =>
      createAnnouncement(
        {
          scope,
          academyId: scope === 'academy' || scope === 'cohort' ? academyId || undefined : undefined,
          cohortId: scope === 'cohort' ? cohortId || undefined : undefined,
          title,
          body,
        },
        activeOrganizationId as string,
      ),
    onSuccess: () => {
      setTitle('');
      setBody('');
      invalidate();
    },
  });
  const publish = useMutation({
    mutationFn: (announcement: Announcement) =>
      publishAnnouncement(announcement.id, announcement.version, activeOrganizationId as string),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: (announcement: Announcement) =>
      archiveAnnouncement(announcement.id, announcement.version, activeOrganizationId as string),
    onSuccess: invalidate,
  });
  const [publishTarget, setPublishTarget] = useState<Announcement | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Announcement | null>(null);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Communication Center"
        description="Announcements and platform notices — direct persistence, no email/SMS delivery."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle as="h2">New announcement</CardTitle>
        </CardHeader>
        <CardContent>
          {create.error instanceof ApiError ? (
            <Alert variant="danger">{create.error.message}</Alert>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
            noValidate
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="scope">
                Scope
              </label>
              <Select
                id="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
              >
                <option value="organization">Organization</option>
                <option value="academy">Academy</option>
                <option value="cohort">Cohort</option>
                <option value="platform">Platform (Super Admin only)</option>
              </Select>
            </div>
            {scope === 'academy' || scope === 'cohort' ? (
              <FormField
                label="Academy id"
                name="academyId"
                value={academyId}
                onChange={(e) => setAcademyId(e.target.value)}
              />
            ) : null}
            {scope === 'cohort' ? (
              <FormField
                label="Cohort id"
                name="cohortId"
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
              />
            ) : null}
            <FormField
              label="Title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="body">
                Body
              </label>
              <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={create.isPending}>
                Save as draft
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">All announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <Alert variant="danger">{(error as Error).message}</Alert>
          ) : (data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="space-y-3">
              {data?.items.map((announcement) => (
                <li
                  key={announcement.id}
                  className="flex items-start justify-between gap-4 rounded-control border border-border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{announcement.title}</p>
                      <Badge tone={STATUS_TONE[announcement.status]}>{announcement.status}</Badge>
                      <Badge tone="neutral">{announcement.scope}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{announcement.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {announcement.status === 'draft' ? (
                      <Button variant="secondary" onClick={() => setPublishTarget(announcement)}>
                        Publish
                      </Button>
                    ) : null}
                    {announcement.status !== 'archived' ? (
                      <Button variant="destructive" onClick={() => setArchiveTarget(announcement)}>
                        Archive
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={publishTarget !== null}
        onClose={() => setPublishTarget(null)}
        onConfirm={async () => {
          if (!publishTarget) return;
          try {
            await publish.mutateAsync(publishTarget);
            setPublishTarget(null);
          } catch {
            // surfaced above via publish.error
          }
        }}
        loading={publish.isPending}
        confirmVariant="primary"
        title="Publish this announcement?"
        description="It sends an in-app notification to everyone in its audience right away — there's no recall."
        confirmLabel="Publish"
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (!archiveTarget) return;
          try {
            await archive.mutateAsync(archiveTarget);
            setArchiveTarget(null);
          } catch {
            // surfaced above via archive.error
          }
        }}
        loading={archive.isPending}
        title="Archive this announcement?"
        description="Notifications already sent for it are unaffected."
        confirmLabel="Archive"
      />
    </div>
  );
}
