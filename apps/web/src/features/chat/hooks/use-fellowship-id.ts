import { useQuery } from '@tanstack/react-query';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useMyEnrollment } from '@/contexts/enrollment-context';
import { useMentorContext } from '@/contexts/mentor-context';
import { getCohortFellowshipId } from '../api/chat-api';

/** A student's chat scope is their own Fellowship — resolved from the
 * enrollment the whole portal is already scoped to (`EnrollmentProvider`),
 * never from a route param a caller could tamper with. */
export function useStudentFellowshipId(): { fellowshipId: string | undefined; isLoading: boolean } {
  const { enrollment, isLoading } = useMyEnrollment();
  return { fellowshipId: enrollment?.fellowshipId, isLoading };
}

/** A mentor's chat scope is the Fellowship behind their currently-selected
 * cohort (`MentorProvider`). `MentorCohortSummary` doesn't carry
 * `fellowshipId` directly, so this resolves it via the existing single-
 * cohort read endpoint (mentors already hold `cohort.read`) rather than
 * adding a new one. */
export function useMentorFellowshipId(): { fellowshipId: string | undefined; isLoading: boolean } {
  const { activeOrganizationId } = useActiveOrganization();
  const { selectedCohortId, isLoading: cohortsLoading } = useMentorContext();
  const query = useQuery({
    queryKey: ['chat', 'cohort-fellowship', selectedCohortId],
    queryFn: () => getCohortFellowshipId(selectedCohortId!, activeOrganizationId),
    enabled: Boolean(selectedCohortId && activeOrganizationId),
  });
  return { fellowshipId: query.data, isLoading: cohortsLoading || query.isLoading };
}
