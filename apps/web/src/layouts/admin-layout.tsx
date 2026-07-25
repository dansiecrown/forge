import { Building2, GraduationCap, LayoutGrid, LogOut, Users2 } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { Select } from '@/components/ui/select';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useSession } from '@/contexts/session-context';
import { cn } from '@/utils';

const NAV_ITEMS = [
  { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { to: '/admin/academies', label: 'Academies', icon: LayoutGrid },
  { to: '/admin/fellowships', label: 'Fellowships', icon: GraduationCap },
  { to: '/admin/cohorts', label: 'Cohorts', icon: Users2 },
];

/** Minimal, purpose-built shell for the four Milestone 3 admin sections —
 * not the full documented Phase-5 web application shell (which doesn't
 * exist yet). Reuses the existing design system as-is; auth pages are
 * untouched. No `glass` here — ADR-0004 reserves glassmorphism for floating
 * surfaces, never page chrome/navigation. */
export function AdminLayout() {
  const { user, memberships, logout } = useSession();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganization();
  const activeMemberships = memberships.filter((membership) => membership.status === 'active');

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6">
        <p className="mb-8 px-2 text-sm font-semibold tracking-tight text-foreground">
          Project Forge
        </p>

        {activeMemberships.length > 0 ? (
          <div className="mb-6 px-2">
            <Select
              aria-label="Active organization"
              value={activeOrganizationId ?? ''}
              onChange={(event) => setActiveOrganizationId(event.target.value)}
            >
              {activeMemberships.map((membership) => (
                <option key={membership.organizationId} value={membership.organizationId}>
                  {membership.organizationId}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-1" aria-label="Admin sections">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-surface-2 text-foreground'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <p className="truncate px-2 text-sm text-muted-foreground">{user?.displayName}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
