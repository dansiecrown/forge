import type {
  CreatePracticalTaskRequest,
  ListPracticalTasksParams,
  PracticalTask,
  ReorderItem,
  UpdatePracticalTaskRequest,
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

export function listPracticalTasks(
  moduleId: string,
  params: ListPracticalTasksParams,
  organizationId?: string,
): Promise<Page<PracticalTask>> {
  return apiRequestPage<PracticalTask>(
    `/weekly-modules/${moduleId}/practical-tasks${buildQuery(params)}`,
    {
      organizationId,
    },
  );
}

export function getPracticalTask(id: string, organizationId?: string): Promise<PracticalTask> {
  return apiRequest<PracticalTask>(`/practical-tasks/${id}`, { organizationId });
}

export function createPracticalTask(
  moduleId: string,
  body: CreatePracticalTaskRequest,
  organizationId?: string,
): Promise<PracticalTask> {
  return apiRequest<PracticalTask>(`/weekly-modules/${moduleId}/practical-tasks`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updatePracticalTask(
  id: string,
  body: UpdatePracticalTaskRequest,
  version: number,
  organizationId?: string,
): Promise<PracticalTask> {
  return apiRequest<PracticalTask>(`/practical-tasks/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function publishPracticalTask(
  id: string,
  version: number,
  organizationId?: string,
): Promise<PracticalTask> {
  return apiRequest<PracticalTask>(`/practical-tasks/${id}/actions/publish`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function archivePracticalTask(
  id: string,
  version: number,
  organizationId?: string,
): Promise<PracticalTask> {
  return apiRequest<PracticalTask>(`/practical-tasks/${id}/actions/archive`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function restorePracticalTask(
  id: string,
  version: number,
  organizationId?: string,
): Promise<PracticalTask> {
  return apiRequest<PracticalTask>(`/practical-tasks/${id}/actions/restore`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function reorderPracticalTasks(
  moduleId: string,
  items: ReorderItem[],
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/weekly-modules/${moduleId}/actions/reorder-tasks`, {
    method: 'POST',
    body: { items },
    organizationId,
  });
}
