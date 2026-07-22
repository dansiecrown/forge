import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ForgotPasswordPage, ResetPasswordPage, SignInPage } from '@/features/identity';
import { AuthLayout } from '@/layouts/auth-layout';
import { HomePage } from '@/pages/home-page';
import { UnauthorizedPage } from '@/pages/unauthorized-page';
import { ProtectedRoute } from './protected-route';

const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [{ path: '/', element: <HomePage /> }],
  },
  {
    path: '/sign-in',
    element: (
      <AuthLayout>
        <SignInPage />
      </AuthLayout>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <AuthLayout>
        <ForgotPasswordPage />
      </AuthLayout>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <AuthLayout>
        <ResetPasswordPage />
      </AuthLayout>
    ),
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
