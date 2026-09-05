import { useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { EnrollmentProvider } from '@/contexts/enrollment-context';
import { useSession } from '@/contexts/session-context';
import { useSignOut } from '@/hooks/use-sign-out';
import { NotificationBell } from '@/components/portal/notification-bell';
import { cn } from '@/utils';

const NAV_ITEMS = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/portal/weekly-learning', label: 'Weekly Learning', icon: BookOpen },
  { to: '/portal/resources', label: 'Learning Resources', icon: BookOpen },
  { to: '/portal/practical-tasks', label: 'Practical Tasks', icon: ListChecks },
  { to: '/portal/progress', label: 'Progress', icon: TrendingUp },
  { to: '/portal/portfolio', label: 'Portfolio', icon: Award },
  { to: '/portal/register', label: 'Apply to a Cohort', icon: ClipboardCheck },
  { to: '/portal/profile', label: 'Profile', icon: User },
  { to: '/portal/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/portal/notifications', label: 'Notifications', icon: Bell },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Student portal sections">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
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

/** The student portal's shell — a sibling to `AdminLayout`, not a variant
 * (same "minimal, purpose-built" framing that layout already uses for
 * itself). Materially different nav shape and a notification bell
 * `AdminLayout` has no equivalent of; no org-switcher since a student's
 * context is one org/enrollment in practice. Responsive: collapses to a
 * slide-out drawer below the `md` breakpoint (the brief explicitly lists
 * "Responsive layouts" as both a design requirement and a verification
 * checklist item, unlike `AdminLayout`'s untouched fixed sidebar). */
export function PortalLayout() {
  const { user } = useSession();
  const signOut = useSignOut();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <EnrollmentProvider>
      <div className="flex h-screen overflow-hidden bg-canvas">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-4 py-6 md:flex">
          <p className="mb-8 px-2 text-sm font-semibold tracking-tight text-foreground">
            Project Forge
          </p>
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
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  Project Forge
                </p>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
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
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-8">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              className="text-muted-foreground hover:text-foreground md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <span className="hidden text-sm font-medium text-foreground md:inline">
              Your learning portal
            </span>
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-5xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </EnrollmentProvider>
  );
}
