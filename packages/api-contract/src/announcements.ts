// Hand-authored request/response contracts for the Communication Center.
// See organizations.ts for the pattern this follows. Direct synchronous
// persistence only — no delivery channels/outbox.

export interface Announcement {
  id: string;
  organizationId: string | null;
  academyId: string | null;
  cohortId: string | null;
  scope: 'platform' | 'organization' | 'academy' | 'cohort';
  authorUserId: string;
  title: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  version: number;
  createdAt: string;
}

export interface CreateAnnouncementRequest {
  scope: 'platform' | 'organization' | 'academy' | 'cohort';
  academyId?: string;
  cohortId?: string;
  title: string;
  body: string;
}

export interface AnnouncementTransitionRequest {
  version: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}
