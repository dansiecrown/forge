import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MentorCohortSummary } from '@forge/api-contract';
import { listMyCohorts } from '@/features/mentor-workspace/api/mentor-workspace-api';
import { useActiveOrganization } from './organization-context';

const SELECTED_COHORT_STORAGE_KEY = 'forge.mentor.selectedCohortId';

interface MentorContextValue {
  cohorts: MentorCohortSummary[];
  /** The mentor's "current cohort" — a real UI concept the roster/huddle
   * pages need, unlike the student's single enrollment. Undefined until
   * `cohorts` has loaded and a default has been picked. */
  selectedCohortId: string | undefined;
  setSelectedCohortId: (cohortId: string) => void;
  isLoading: boolean;
  error: Error | null;
}

const MentorContext = createContext<MentorContextValue | null>(null);

/** Mounted once at the `/mentor` shell (`MentorLayout`), mirroring
 * `EnrollmentProvider`'s "fetch once, share via context" pattern plus
 * `OrganizationProvider`'s localStorage-persisted-selection pattern —
 * combined here because `selectedCohortId` is UI state derived from API
 * data, not session data. */
export function MentorProvider({ children }: { children: ReactNode }) {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['mentors', 'me', 'cohorts', activeOrganizationId],
    queryFn: () => listMyCohorts(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });
  const cohorts = useMemo(() => query.data ?? [], [query.data]);

  const [selectedCohortId, setSelectedCohortIdState] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (cohorts.length === 0) {
      setSelectedCohortIdState(undefined);
      return;
    }
    const remembered = window.localStorage.getItem(SELECTED_COHORT_STORAGE_KEY);
    const stillValid = cohorts.some((c) => c.id === remembered);
    setSelectedCohortIdState(stillValid ? (remembered as string) : cohorts[0].id);
  }, [cohorts]);

  const setSelectedCohortId = useCallback((cohortId: string) => {
    window.localStorage.setItem(SELECTED_COHORT_STORAGE_KEY, cohortId);
    setSelectedCohortIdState(cohortId);
  }, []);

  const value = useMemo<MentorContextValue>(
    () => ({
      cohorts,
      selectedCohortId,
      setSelectedCohortId,
      isLoading: query.isLoading,
      error: query.error as Error | null,
    }),
    [cohorts, selectedCohortId, setSelectedCohortId, query.isLoading, query.error],
  );

  return <MentorContext.Provider value={value}>{children}</MentorContext.Provider>;
}

export function useMentorContext(): MentorContextValue {
  const context = useContext(MentorContext);
  if (!context) {
    throw new Error('useMentorContext must be used within a MentorProvider');
  }
  return context;
}
