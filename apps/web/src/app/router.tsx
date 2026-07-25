import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AcademiesListPage, AcademyCreatePage, AcademyDetailPage } from '@/features/academies';
import { CohortCreatePage, CohortDetailPage, CohortsListPage } from '@/features/cohorts';
import {
  FellowshipCreatePage,
  FellowshipDetailPage,
  FellowshipsListPage,
} from '@/features/fellowships';
import { ForgotPasswordPage, ResetPasswordPage, SignInPage } from '@/features/identity';
import {
  OrganizationCreatePage,
  OrganizationDetailPage,
  OrganizationsListPage,
} from '@/features/organizations';
import { AdminLayout } from '@/layouts/admin-layout';
import { AuthLayout } from '@/layouts/auth-layout';
import { HomePage } from '@/pages/home-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { UnauthorizedPage } from '@/pages/unauthorized-page';
import { ProtectedRoute } from './protected-route';

const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <HomePage /> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { path: 'organizations', element: <OrganizationsListPage /> },
          { path: 'organizations/new', element: <OrganizationCreatePage /> },
          { path: 'organizations/:orgId', element: <OrganizationDetailPage /> },
          { path: 'academies', element: <AcademiesListPage /> },
          { path: 'academies/new', element: <AcademyCreatePage /> },
          { path: 'academies/:academyId', element: <AcademyDetailPage /> },
          { path: 'fellowships', element: <FellowshipsListPage /> },
          { path: 'fellowships/new', element: <FellowshipCreatePage /> },
          { path: 'fellowships/:fellowshipId', element: <FellowshipDetailPage /> },
          { path: 'cohorts', element: <CohortsListPage /> },
          { path: 'cohorts/new', element: <CohortCreatePage /> },
          { path: 'cohorts/:cohortId', element: <CohortDetailPage /> },
        ],
      },
    ],
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
  { path: '*', element: <NotFoundPage /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
