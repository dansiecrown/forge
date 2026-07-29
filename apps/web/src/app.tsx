import { AppRouter } from '@/app/router';
import { OrganizationProvider } from '@/contexts/organization-context';
import { SessionProvider } from '@/contexts/session-context';
import { ThemeProvider } from '@/contexts/theme-context';

export function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <OrganizationProvider>
          <AppRouter />
        </OrganizationProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
