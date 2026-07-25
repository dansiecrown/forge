import { AppRouter } from '@/app/router';
import { OrganizationProvider } from '@/contexts/organization-context';
import { SessionProvider } from '@/contexts/session-context';

export function App() {
  return (
    <SessionProvider>
      <OrganizationProvider>
        <AppRouter />
      </OrganizationProvider>
    </SessionProvider>
  );
}
