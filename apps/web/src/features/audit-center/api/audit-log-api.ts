import type { AuditLogEntry, SearchAuditLogParams } from '@forge/api-contract';
import { apiRequestPage, type Page } from '@/api/client';

function buildQuery(params: SearchAuditLogParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function searchAuditLog(
  params: SearchAuditLogParams,
  organizationId?: string,
): Promise<Page<AuditLogEntry>> {
  return apiRequestPage<AuditLogEntry>(`/admin/audit-logs${buildQuery(params)}`, {
    organizationId,
  });
}
