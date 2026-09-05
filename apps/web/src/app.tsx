import { AppRouter } from '@/app/router';
import { OrganizationProvider } from '@/contexts/organization-context';
import { SessionProvider } from '@/contexts/session-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { ToastProvider } from '@/components/ui/toast';

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SessionProvider>
          <OrganizationProvider>
            <AppRouter />
          </OrganizationProvider>
        </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
