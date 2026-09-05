import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Enrollment } from '@forge/api-contract';
import { apiRequestPage } from '@/api/client';
import { useActiveOrganization } from './organization-context';

function listMyEnrollments(organizationId: string | undefined) {
  return apiRequestPage<Enrollment>('/enrollments/me', { organizationId });
}

interface EnrollmentContextValue {
  /** The learner's enrollment in the active organization — in practice
   * almost always exactly one ("one active enrollment per fellowship"), but
   * a caller could hold enrollments across multiple fellowships; the
   * portal picks the first `active` one, falling back to the first any. */
  enrollment: Enrollment | undefined;
  isLoading: boolean;
  error: Error | null;
}

const EnrollmentContext = createContext<EnrollmentContextValue | null>(null);

/** Mounted once at the `/portal` shell (`PortalLayout`) so every student
 * page can read the caller's own enrollment id without each page
 * re-fetching or threading an `:id` route param — the whole student portal
 * is scoped to one learner's own data. */
export function EnrollmentProvider({ children }: { children: ReactNode }) {
  const { activeOrganizationId } = useActiveOrganization();
  const query = useQuery({
    queryKey: ['enrollments', 'me', activeOrganizationId],
    queryFn: () => listMyEnrollments(activeOrganizationId),
    enabled: Boolean(activeOrganizationId),
  });

  const items = query.data?.items ?? [];
  const enrollment = items.find((e) => e.status === 'active') ?? items[0];

  return (
    <EnrollmentContext.Provider
      value={{ enrollment, isLoading: query.isLoading, error: query.error as Error | null }}
    >
      {children}
    </EnrollmentContext.Provider>
  );
}

export function useMyEnrollment(): EnrollmentContextValue {
  const context = useContext(EnrollmentContext);
  if (!context) {
    throw new Error('useMyEnrollment must be used within an EnrollmentProvider');
  }
  return context;
}
