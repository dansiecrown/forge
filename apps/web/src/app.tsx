import { AppRouter } from '@/app/router';
import { SessionProvider } from '@/contexts/session-context';

export function App() {
  return (
    <SessionProvider>
      <AppRouter />
    </SessionProvider>
  );
}
