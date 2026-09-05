import { useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  Users2,
  X,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { Select } from '@/components/ui/select';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useSession } from '@/contexts/session-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useSignOut } from '@/hooks/use-sign-out';
import { cn } from '@/utils';

// Extended in Milestone 7 (Administration Platform) from the original four
// Milestone 3 sections — the mobile-drawer pattern below is lifted from
// mentor-layout.tsx now that this nav has grown past what a fixed sidebar
// alone comfortably serves on small screens.
//
// `requiresPermission` is the permission key each section's own list/detail
// endpoint actually requires — checked via `usePermissions()` below so a
// role only ever sees sections it can use. Previously every admin role saw
// the identical nav (e.g. an Academy Admin saw "Organizations" and "Audit"
// despite lacking `organization.list`/`audit.read` entirely, so both 403'd
// immediately) — a real, reported gap, not by design.
//
// "Organizations" is gated on `organization.read` (which ORG_ADMIN holds
// for their own org), not `organization.list` (the platform-wide listing —
// SUPER_ADMIN only): an Org Admin still needs to reach *their own*
// organization's settings, just never a cross-tenant list. `NavList` below
// routes non-super-admins straight to their own org's detail page instead
// of the list.
const NAV_ITEMS = [
  {
    to: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
    requiresPermission: 'reports.read',
  },
  {
    to: '/admin/organizations',
    label: 'Organizations',
    icon: Building2,
    requiresPermission: 'organization.read',
  },
  {
    to: '/admin/academies',
    label: 'Academies',
    icon: LayoutGrid,
    requiresPermission: 'academy.read',
  },
  {
    to: '/admin/fellowships',
    label: 'Fellowships',
    icon: GraduationCap,
    requiresPermission: 'fellowship.read',
  },
  { to: '/admin/cohorts', label: 'Cohorts', icon: Users2, requiresPermission: 'cohort.read' },
  { to: '/admin/users', label: 'Users', icon: Users, requiresPermission: 'user.read' },
  { to: '/admin/roles', label: 'Roles', icon: ShieldCheck, requiresPermission: 'role.read' },
  { to: '/admin/audit', label: 'Audit', icon: FileClock, requiresPermission: 'audit.read' },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3, requiresPermission: 'reports.read' },
  {
    to: '/admin/announcements',
    label: 'Communications',
    icon: Bell,
    requiresPermission: 'announcement.read',
  },
  {
    to: '/admin/certificates',
    label: 'Certificates',
    icon: Award,
    requiresPermission: 'certificate.read',
  },
  {
    to: '/admin/applications',
    label: 'Applications',
    icon: ClipboardCheck,
    requiresPermission: 'cohort.application.read',
  },
  {
    to: '/admin/settings',
    label: 'Settings',
    icon: SettingsIcon,
    requiresPermission: 'platform.settings.manage',
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { has, isSuperAdmin } = usePermissions();
  const { activeOrganizationId } = useActiveOrganization();
  const visibleItems = NAV_ITEMS.filter((item) => has(item.requiresPermission));

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Admin sections">
      {visibleItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={
            to === '/admin/organizations' && !isSuperAdmin && activeOrganizationId
              ? `/admin/organizations/${activeOrganizationId}`
              : to
          }
          end={end}
          onClick={onNavigate}
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
  );
}

/** Minimal, purpose-built shell — reuses the existing design system as-is;
 * auth pages are untouched. No `glass` here — ADR-0004 reserves
 * glassmorphism for floating surfaces, never page chrome/navigation. */
export function AdminLayout() {
  const { user, memberships } = useSession();
  const signOut = useSignOut();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganization();
  const activeMemberships = memberships.filter((membership) => membership.status === 'active');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const orgSwitcher =
    activeMemberships.length > 0 ? (
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
    ) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-4 py-6 md:flex">
        <p className="mb-8 px-2 text-sm font-semibold tracking-tight text-foreground">
          Project Forge
        </p>
        {orgSwitcher}
        <NavList />
        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <p className="truncate px-2 text-sm text-muted-foreground">{user?.displayName}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-canvas/70"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-surface px-4 py-6 shadow-subtle">
            <div className="mb-8 flex items-center justify-between px-2">
              <p className="text-sm font-semibold tracking-tight text-foreground">Project Forge</p>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {orgSwitcher}
            <NavList onNavigate={() => setDrawerOpen(false)} />
            <div className="mt-6 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <span className="text-sm font-medium text-foreground">Admin</span>
          <span aria-hidden="true" />
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
