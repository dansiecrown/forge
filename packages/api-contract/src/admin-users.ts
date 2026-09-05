// Hand-authored request/response contracts for User Management
// (Administration Platform). See organizations.ts for the pattern.

export interface AdminUserSummary {
  id: string;
  displayName: string;
  emailCanonical: string;
  status: 'invited' | 'active' | 'suspended' | 'deactivated';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ListAdminUsersParams {
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface AdminSessionSummary {
  id: string;
  deviceLabel: string | null;
  issuedAt: string;
  expiresAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: 'success' | 'failure';
  occurredAt: string;
}
