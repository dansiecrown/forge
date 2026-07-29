// Thin fetch wrappers over the `StudentCurriculumController` backend
// routes (Milestone 5). Shared by every portal feature that reads a
// student's curriculum — Dashboard, Weekly Learning, Lesson reader,
// Learning Resources, Practical Tasks, Progress Center — since they're all
// facets of one backend controller reading the same frozen
// `curriculumSnapshot`, not six independent resources.

import type {
  ListLearningResourcesForStudentParams,
  StudentActivityItem,
  StudentDashboard,
  StudentLessonDetail,
  StudentModuleDetail,
  StudentModuleSummary,
  StudentResourceSummary,
  StudentTaskSummary,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

function buildQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [
    string,
    string | number | boolean | undefined,
  ][]) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listWeeklyModules(enrollmentId: string, organizationId?: string) {
  return apiRequest<StudentModuleSummary[]>(`/enrollments/${enrollmentId}/weekly-modules`, {
    organizationId,
  });
}

export function getWeeklyModule(enrollmentId: string, moduleId: string, organizationId?: string) {
  return apiRequest<StudentModuleDetail>(
    `/enrollments/${enrollmentId}/weekly-modules/${moduleId}`,
    { organizationId },
  );
}

export function getLesson(enrollmentId: string, lessonId: string, organizationId?: string) {
  return apiRequest<StudentLessonDetail>(`/enrollments/${enrollmentId}/lessons/${lessonId}`, {
    organizationId,
  });
}

export function listLearningResources(
  enrollmentId: string,
  params: ListLearningResourcesForStudentParams,
  organizationId?: string,
) {
  return apiRequest<StudentResourceSummary[]>(
    `/enrollments/${enrollmentId}/learning-resources${buildQuery(params)}`,
    { organizationId },
  );
}

export function listPracticalTasks(enrollmentId: string, organizationId?: string) {
  return apiRequest<StudentTaskSummary[]>(`/enrollments/${enrollmentId}/practical-tasks`, {
    organizationId,
  });
}

export function getPracticalTask(enrollmentId: string, taskId: string, organizationId?: string) {
  return apiRequest<StudentTaskSummary>(`/enrollments/${enrollmentId}/practical-tasks/${taskId}`, {
    organizationId,
  });
}

export function getActivity(enrollmentId: string, limit: number, organizationId?: string) {
  return apiRequest<StudentActivityItem[]>(`/enrollments/${enrollmentId}/activity?limit=${limit}`, {
    organizationId,
  });
}

export function getDashboard(enrollmentId: string, organizationId?: string) {
  return apiRequest<StudentDashboard>(`/enrollments/${enrollmentId}/dashboard`, {
    organizationId,
  });
}

export function listBookmarks(enrollmentId: string, organizationId?: string) {
  return apiRequest<StudentResourceSummary[]>(`/enrollments/${enrollmentId}/bookmarks`, {
    organizationId,
  });
}

export function addBookmark(enrollmentId: string, resourceId: string, organizationId?: string) {
  return apiRequest<void>(`/enrollments/${enrollmentId}/bookmarks/${resourceId}`, {
    method: 'PUT',
    organizationId,
  });
}

export function removeBookmark(enrollmentId: string, resourceId: string, organizationId?: string) {
  return apiRequest<void>(`/enrollments/${enrollmentId}/bookmarks/${resourceId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export function saveTaskSubmissionDraft(
  taskId: string,
  enrollmentId: string,
  data: { repositoryUrl?: string; liveDemoUrl?: string },
  organizationId?: string,
) {
  return apiRequest<void>(`/practical-tasks/${taskId}/actions/save-draft`, {
    method: 'POST',
    body: { enrollmentId, ...data },
    organizationId,
  });
}

export function submitTask(taskId: string, enrollmentId: string, organizationId?: string) {
  return apiRequest<void>(`/practical-tasks/${taskId}/actions/submit`, {
    method: 'POST',
    body: { enrollmentId },
    organizationId,
  });
}

export function completeLesson(lessonId: string, enrollmentId: string, organizationId?: string) {
  return apiRequest<void>(`/lessons/${lessonId}/actions/complete`, {
    method: 'POST',
    body: { enrollmentId },
    organizationId,
  });
}

export function acknowledgeResource(
  resourceId: string,
  enrollmentId: string,
  organizationId?: string,
) {
  return apiRequest<void>(`/learning-resources/${resourceId}/actions/acknowledge`, {
    method: 'POST',
    body: { enrollmentId },
    organizationId,
  });
}
