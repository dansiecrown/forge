import { useQuery } from '@tanstack/react-query';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  getMentorDashboard,
  getStudentWorkspace,
  listCohortStudents,
  listMyCohorts,
  listReviewQueue,
  type ListCohortStudentsParams,
} from '../api/mentor-workspace-api';

export function useMyCohorts() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['mentors', 'me', 'cohorts', activeOrganizationId],
    queryFn: () => listMyCohorts(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
}

export function useMentorDashboard() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['mentors', 'me', 'dashboard', activeOrganizationId],
    queryFn: () => getMentorDashboard(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
}

export function useReviewQueue() {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['mentors', 'me', 'review-queue', activeOrganizationId],
    queryFn: () => listReviewQueue(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
}

export function useCohortStudents(cohortId: string | undefined, params: ListCohortStudentsParams) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['mentors', 'cohorts', cohortId, 'students', params, activeOrganizationId],
    queryFn: () => listCohortStudents(cohortId as string, params, activeOrganizationId),
    enabled: Boolean(cohortId) && Boolean(activeOrganizationId),
  });
}

export function useStudentWorkspace(enrollmentId: string | undefined) {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery({
    queryKey: ['mentors', 'students', enrollmentId, 'workspace', activeOrganizationId],
    queryFn: () => getStudentWorkspace(enrollmentId as string, activeOrganizationId),
    enabled: Boolean(enrollmentId) && Boolean(activeOrganizationId),
  });
}
