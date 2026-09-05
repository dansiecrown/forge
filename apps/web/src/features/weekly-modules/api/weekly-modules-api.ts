import type {
  CreateWeeklyModuleRequest,
  ListWeeklyModulesParams,
  UpdateWeeklyModuleRequest,
  WeeklyModule,
} from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

function buildQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listWeeklyModules(
  courseId: string,
  params: ListWeeklyModulesParams,
  organizationId?: string,
): Promise<Page<WeeklyModule>> {
  return apiRequestPage<WeeklyModule>(`/courses/${courseId}/weekly-modules${buildQuery(params)}`, {
    organizationId,
  });
}

export function getWeeklyModule(id: string, organizationId?: string): Promise<WeeklyModule> {
  return apiRequest<WeeklyModule>(`/weekly-modules/${id}`, { organizationId });
}

export function createWeeklyModule(
  courseId: string,
  body: CreateWeeklyModuleRequest,
  organizationId?: string,
): Promise<WeeklyModule> {
  return apiRequest<WeeklyModule>(`/courses/${courseId}/weekly-modules`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateWeeklyModule(
  id: string,
  body: UpdateWeeklyModuleRequest,
  version: number,
  organizationId?: string,
): Promise<WeeklyModule> {
  return apiRequest<WeeklyModule>(`/weekly-modules/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function publishWeeklyModule(
  id: string,
  version: number,
  organizationId?: string,
): Promise<WeeklyModule> {
  return apiRequest<WeeklyModule>(`/weekly-modules/${id}/actions/publish`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function archiveWeeklyModule(
  id: string,
  version: number,
  organizationId?: string,
): Promise<WeeklyModule> {
  return apiRequest<WeeklyModule>(`/weekly-modules/${id}/actions/archive`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function restoreWeeklyModule(
  id: string,
  version: number,
  organizationId?: string,
): Promise<WeeklyModule> {
  return apiRequest<WeeklyModule>(`/weekly-modules/${id}/actions/restore`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}
