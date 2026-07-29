import type {
  CreateLessonRequest,
  Lesson,
  ListLessonsParams,
  ReorderItem,
  UpdateLessonRequest,
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

export function listLessons(
  moduleId: string,
  params: ListLessonsParams,
  organizationId?: string,
): Promise<Page<Lesson>> {
  return apiRequestPage<Lesson>(`/weekly-modules/${moduleId}/lessons${buildQuery(params)}`, {
    organizationId,
  });
}

export function getLesson(id: string, organizationId?: string): Promise<Lesson> {
  return apiRequest<Lesson>(`/lessons/${id}`, { organizationId });
}

export function createLesson(
  moduleId: string,
  body: CreateLessonRequest,
  organizationId?: string,
): Promise<Lesson> {
  return apiRequest<Lesson>(`/weekly-modules/${moduleId}/lessons`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateLesson(
  id: string,
  body: UpdateLessonRequest,
  version: number,
  organizationId?: string,
): Promise<Lesson> {
  return apiRequest<Lesson>(`/lessons/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function publishLesson(
  id: string,
  version: number,
  organizationId?: string,
): Promise<Lesson> {
  return apiRequest<Lesson>(`/lessons/${id}/actions/publish`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function archiveLesson(
  id: string,
  version: number,
  organizationId?: string,
): Promise<Lesson> {
  return apiRequest<Lesson>(`/lessons/${id}/actions/archive`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function restoreLesson(
  id: string,
  version: number,
  organizationId?: string,
): Promise<Lesson> {
  return apiRequest<Lesson>(`/lessons/${id}/actions/restore`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function reorderLessons(
  moduleId: string,
  items: ReorderItem[],
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/weekly-modules/${moduleId}/actions/reorder-lessons`, {
    method: 'POST',
    body: { items },
    organizationId,
  });
}
