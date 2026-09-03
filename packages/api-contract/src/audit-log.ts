// Hand-authored request/response contracts for the Audit Center. See
// organizations.ts for the pattern this follows.

export interface AuditLogEntry {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: 'success' | 'failure';
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

export interface SearchAuditLogParams {
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  outcome?: 'success' | 'failure';
  occurredFrom?: string;
  occurredTo?: string;
  cursor?: string;
  limit?: number;
}
