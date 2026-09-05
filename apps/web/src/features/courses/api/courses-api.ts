import type {
  Course,
  CreateCourseRequest,
  ListCoursesParams,
  ReorderItem,
  UpdateCourseRequest,
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

export function listCourses(
  trackId: string,
  params: ListCoursesParams,
  organizationId?: string,
): Promise<Page<Course>> {
  return apiRequestPage<Course>(`/learning-tracks/${trackId}/courses${buildQuery(params)}`, {
    organizationId,
  });
}

export function getCourse(id: string, organizationId?: string): Promise<Course> {
  return apiRequest<Course>(`/courses/${id}`, { organizationId });
}

export function createCourse(
  trackId: string,
  body: CreateCourseRequest,
  organizationId?: string,
): Promise<Course> {
  return apiRequest<Course>(`/learning-tracks/${trackId}/courses`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateCourse(
  id: string,
  body: UpdateCourseRequest,
  version: number,
  organizationId?: string,
): Promise<Course> {
  return apiRequest<Course>(`/courses/${id}`, {
    method: 'PATCH',
    body,
    organizationId,
    ifMatch: version,
  });
}

export function publishCourse(
  id: string,
  version: number,
  organizationId?: string,
): Promise<Course> {
  return apiRequest<Course>(`/courses/${id}/actions/publish`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function archiveCourse(
  id: string,
  version: number,
  organizationId?: string,
): Promise<Course> {
  return apiRequest<Course>(`/courses/${id}/actions/archive`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function restoreCourse(
  id: string,
  version: number,
  organizationId?: string,
): Promise<Course> {
  return apiRequest<Course>(`/courses/${id}/actions/restore`, {
    method: 'POST',
    body: { version },
    organizationId,
  });
}

export function reorderCourses(
  trackId: string,
  items: ReorderItem[],
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/learning-tracks/${trackId}/actions/reorder-courses`, {
    method: 'POST',
    body: { items },
    organizationId,
  });
}
