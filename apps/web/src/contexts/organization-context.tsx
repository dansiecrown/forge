import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSession } from './session-context';

const ACTIVE_ORGANIZATION_STORAGE_KEY = 'forge.activeOrganizationId';

interface OrganizationContextValue {
  /** Undefined until the caller's memberships have loaded and a default has
   * been picked — every admin API call needs this for the `X-Organization-Id`
   * header (apps/web/src/api/client.ts). */
  activeOrganizationId: string | undefined;
  setActiveOrganizationId: (organizationId: string) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/** Defaults to the caller's first active membership, remembers the choice in
 * localStorage, and falls back to the first membership again if the
 * remembered organization isn't one the caller belongs to (anymore). */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { memberships } = useSession();
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    const activeMemberships = memberships.filter((membership) => membership.status === 'active');
    if (activeMemberships.length === 0) {
      setActiveOrganizationIdState(undefined);
      return;
    }

    const remembered = window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
    const stillValid = activeMemberships.some((m) => m.organizationId === remembered);
    setActiveOrganizationIdState(
      stillValid ? (remembered as string) : activeMemberships[0].organizationId,
    );
  }, [memberships]);

  const setActiveOrganizationId = useCallback((organizationId: string) => {
    window.localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, organizationId);
    setActiveOrganizationIdState(organizationId);
  }, []);

  const value = useMemo<OrganizationContextValue>(
    () => ({ activeOrganizationId, setActiveOrganizationId }),
    [activeOrganizationId, setActiveOrganizationId],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useActiveOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useActiveOrganization must be used within an OrganizationProvider');
  }
  return context;
}
