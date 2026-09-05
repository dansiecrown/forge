import { useState } from 'react';
import {
  CalendarCheck,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings as SettingsIcon,
  Users,
  X,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { MentorProvider } from '@/contexts/mentor-context';
import { useSession } from '@/contexts/session-context';
import { useSignOut } from '@/hooks/use-sign-out';
import { cn } from '@/utils';

const NAV_ITEMS = [
  { to: '/mentor', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/mentor/cohorts', label: 'My Cohorts', icon: Users },
  { to: '/mentor/review-queue', label: 'Review Queue', icon: ClipboardCheck },
  { to: '/mentor/huddles', label: 'Huddles', icon: CalendarCheck },
  { to: '/mentor/chat', label: 'Chat', icon: MessageSquare },
  { to: '/mentor/settings', label: 'Settings', icon: SettingsIcon },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Mentor portal sections">
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

/** The mentor portal's shell — a sibling to `PortalLayout`/`AdminLayout`,
 * same desktop-sidebar-+-mobile-drawer skeleton. Cohort roster and student
 * workspace are drill-down pages, not top-level nav — mirrors how
 * `/portal/weekly-learning/:moduleId` isn't in `PortalLayout`'s nav either.
 * Profile is reached via Settings -> Profile tab, not its own nav item,
 * matching the student portal's own pattern. */
export function MentorLayout() {
  const { user } = useSession();
  const signOut = useSignOut();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <MentorProvider>
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
              Mentor portal
            </span>
            <span aria-hidden="true" className="md:hidden" />
          </header>
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-5xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </MentorProvider>
  );
}
