import type { Announcement, CreateAnnouncementRequest } from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

export function listAnnouncements(organizationId: string): Promise<Page<Announcement>> {
  return apiRequestPage<Announcement>('/admin/announcements', { organizationId });
}

export function createAnnouncement(
  body: CreateAnnouncementRequest,
  organizationId: string,
): Promise<Announcement> {
  return apiRequest<Announcement>('/admin/announcements', { method: 'POST', body, organizationId });
}

export function publishAnnouncement(
  id: string,
  version: number,
  organizationId: string,
): Promise<Announcement> {
  return apiRequest<Announcement>(`/admin/announcements/${id}/actions/publish`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function archiveAnnouncement(
  id: string,
  version: number,
  organizationId: string,
): Promise<Announcement> {
  return apiRequest<Announcement>(`/admin/announcements/${id}/actions/archive`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}
