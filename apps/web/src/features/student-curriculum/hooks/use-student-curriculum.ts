import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListLearningResourcesForStudentParams } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useMyEnrollment } from '@/contexts/enrollment-context';
import {
  acknowledgeResource,
  addBookmark,
  completeLesson,
  getActivity,
  getDashboard,
  getLesson,
  getPracticalTask,
  getWeeklyModule,
  listBookmarks,
  listLearningResources,
  listPracticalTasks,
  listWeeklyModules,
  removeBookmark,
  saveTaskSubmissionDraft,
  submitTask,
} from '../api/student-curriculum-api';

function useEnrollmentId() {
  const { enrollment } = useMyEnrollment();
  return enrollment?.id;
}

export function useWeeklyModules() {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: ['student-curriculum', 'weekly-modules', enrollmentId, activeOrganizationId],
    queryFn: () => listWeeklyModules(enrollmentId as string, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(activeOrganizationId),
  });
}

export function useWeeklyModule(moduleId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: ['student-curriculum', 'weekly-module', enrollmentId, moduleId, activeOrganizationId],
    queryFn: () =>
      getWeeklyModule(enrollmentId as string, moduleId as string, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(moduleId) && Boolean(activeOrganizationId),
  });
}

export function useLesson(lessonId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: ['student-curriculum', 'lesson', enrollmentId, lessonId, activeOrganizationId],
    queryFn: () => getLesson(enrollmentId as string, lessonId as string, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(lessonId) && Boolean(activeOrganizationId),
  });
}

export function useLearningResources(params: ListLearningResourcesForStudentParams) {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: [
      'student-curriculum',
      'learning-resources',
      enrollmentId,
      activeOrganizationId,
      params,
    ],
    queryFn: () => listLearningResources(enrollmentId as string, params, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(activeOrganizationId),
  });
}

export function usePracticalTasks() {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: ['student-curriculum', 'practical-tasks', enrollmentId, activeOrganizationId],
    queryFn: () => listPracticalTasks(enrollmentId as string, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(activeOrganizationId),
  });
}

export function usePracticalTask(taskId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: ['student-curriculum', 'practical-task', enrollmentId, taskId, activeOrganizationId],
    queryFn: () => getPracticalTask(enrollmentId as string, taskId as string, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(taskId) && Boolean(activeOrganizationId),
  });
}

export function useActivity(limit = 20) {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: ['student-curriculum', 'activity', enrollmentId, activeOrganizationId, limit],
    queryFn: () => getActivity(enrollmentId as string, limit, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(activeOrganizationId),
  });
}

export function useDashboard() {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: ['student-curriculum', 'dashboard', enrollmentId, activeOrganizationId],
    queryFn: () => getDashboard(enrollmentId as string, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(activeOrganizationId),
  });
}

export function useBookmarks() {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  return useQuery({
    queryKey: ['student-curriculum', 'bookmarks', enrollmentId, activeOrganizationId],
    queryFn: () => listBookmarks(enrollmentId as string, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(activeOrganizationId),
  });
}

function useInvalidateCurriculum() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['student-curriculum'] });
}

export function useToggleBookmark() {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  const invalidate = useInvalidateCurriculum();

  const add = useMutation({
    mutationFn: (resourceId: string) =>
      addBookmark(enrollmentId as string, resourceId, activeOrganizationId),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (resourceId: string) =>
      removeBookmark(enrollmentId as string, resourceId, activeOrganizationId),
    onSuccess: invalidate,
  });

  return { add, remove };
}

export function useCompleteLesson() {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  const invalidate = useInvalidateCurriculum();
  return useMutation({
    mutationFn: (lessonId: string) =>
      completeLesson(lessonId, enrollmentId as string, activeOrganizationId),
    onSuccess: invalidate,
  });
}

export function useAcknowledgeResource() {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  const invalidate = useInvalidateCurriculum();
  return useMutation({
    mutationFn: (resourceId: string) =>
      acknowledgeResource(resourceId, enrollmentId as string, activeOrganizationId),
    onSuccess: invalidate,
  });
}

export function useSaveTaskDraft(taskId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  const invalidate = useInvalidateCurriculum();
  return useMutation({
    mutationFn: (data: { repositoryUrl?: string; liveDemoUrl?: string }) =>
      saveTaskSubmissionDraft(taskId, enrollmentId as string, data, activeOrganizationId),
    onSuccess: invalidate,
  });
}

export function useSubmitTask(taskId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const enrollmentId = useEnrollmentId();
  const invalidate = useInvalidateCurriculum();
  return useMutation({
    mutationFn: () => submitTask(taskId, enrollmentId as string, activeOrganizationId),
    onSuccess: invalidate,
  });
}
