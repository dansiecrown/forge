import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AcademiesListPage, AcademyCreatePage, AcademyDetailPage } from '@/features/academies';
import {
  AdminCohortApplicationDetailPage,
  AdminCohortApplicationsListPage,
} from '@/features/admin-cohort-applications';
import { AdminDashboardPage } from '@/features/admin-dashboard';
import { AdminSettingsPage } from '@/features/admin-settings';
import { AdminUserDetailPage, AdminUsersListPage } from '@/features/admin-users';
import { AnnouncementsPage } from '@/features/announcements';
import { AuditCenterPage } from '@/features/audit-center';
import { CertificatesPage } from '@/features/certificates';
import { ReportsPage } from '@/features/reports';
import {
  PermissionMatrixPage,
  RoleCreatePage,
  RoleDetailPage,
  RolesListPage,
} from '@/features/roles';
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
import {
  LearningTrackCreatePage,
  LearningTrackDetailPage,
  LearningTracksListPage,
} from '@/features/learning-tracks';
import { CourseCreatePage, CourseDetailPage } from '@/features/courses';
import { WeeklyModuleCreatePage, WeeklyModuleDetailPage } from '@/features/weekly-modules';
import { LessonCreatePage, LessonDetailPage } from '@/features/lessons';
import {
  LearningResourceCreatePage,
  LearningResourceDetailPage,
} from '@/features/learning-resources';
import { PracticalTaskCreatePage, PracticalTaskDetailPage } from '@/features/practical-tasks';
import { AdminLayout } from '@/layouts/admin-layout';
import { AuthLayout } from '@/layouts/auth-layout';
import { MentorLayout } from '@/layouts/mentor-layout';
import { PortalLayout } from '@/layouts/portal-layout';
import { PortalRouteSkeleton } from '@/components/portal/portal-route-skeleton';
import { ApplyPage } from '@/features/apply';
import { CertificateVerifyPage } from '@/pages/certificate-verify-page';
import { HomePage } from '@/pages/home-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { UnauthorizedPage } from '@/pages/unauthorized-page';
import { ProtectedRoute } from './protected-route';
import { RequireRole } from './require-role';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'ACADEMY_ADMIN'];

/** Named-export equivalent of `React.lazy` — every feature barrel exports
 * named components (matching the rest of this file's imports), not a
 * default. Used only for the `/portal` route tree (Milestone 5's explicit
 * "lazy-loaded routes" ask) — `/admin` stays eager and untouched. */
function lazyNamed<P extends object>(
  factory: () => Promise<Record<string, ComponentType<P>>>,
  name: string,
) {
  return lazy(() => factory().then((module) => ({ default: module[name] as ComponentType<P> })));
}

const PortalDashboardPage = lazyNamed(
  () => import('@/features/portal-dashboard'),
  'PortalDashboardPage',
);
const WeeklyLearningPage = lazyNamed(
  () => import('@/features/weekly-learning'),
  'WeeklyLearningPage',
);
const WeeklyModulePage = lazyNamed(() => import('@/features/weekly-learning'), 'WeeklyModulePage');
const LessonReaderPage = lazyNamed(() => import('@/features/weekly-learning'), 'LessonReaderPage');
const LearningResourcesPortalPage = lazyNamed(
  () => import('@/features/learning-resources-portal'),
  'LearningResourcesPortalPage',
);
const PracticalTasksPortalPage = lazyNamed(
  () => import('@/features/practical-tasks-portal'),
  'PracticalTasksPortalPage',
);
const PracticalTaskPortalDetailPage = lazyNamed(
  () => import('@/features/practical-tasks-portal'),
  'PracticalTaskPortalDetailPage',
);
const ProgressCenterPage = lazyNamed(
  () => import('@/features/progress-center'),
  'ProgressCenterPage',
);
const PortfolioPage = lazyNamed(() => import('@/features/portfolio'), 'PortfolioPage');
const PortfolioProjectCreatePage = lazyNamed(
  () => import('@/features/portfolio'),
  'PortfolioProjectCreatePage',
);
const PortfolioProjectEditPage = lazyNamed(
  () => import('@/features/portfolio'),
  'PortfolioProjectEditPage',
);
const ProfilePage = lazyNamed(() => import('@/features/profile'), 'ProfilePage');
const SettingsPage = lazyNamed<{ variant?: 'student' | 'mentor' }>(
  () => import('@/features/settings'),
  'SettingsPage',
);
const NotificationsPage = lazyNamed(() => import('@/features/notifications'), 'NotificationsPage');
const StudentRegisterPage = lazyNamed(
  () => import('@/features/cohort-applications'),
  'StudentRegisterPage',
);

const MentorDashboardPage = lazyNamed(
  () => import('@/features/mentor-dashboard'),
  'MentorDashboardPage',
);
const MentorCohortsListPage = lazyNamed(
  () => import('@/features/mentor-workspace'),
  'MentorCohortsListPage',
);
const CohortWorkspacePage = lazyNamed(
  () => import('@/features/mentor-workspace'),
  'CohortWorkspacePage',
);
const StudentWorkspacePage = lazyNamed(
  () => import('@/features/mentor-workspace'),
  'StudentWorkspacePage',
);
const ReviewQueuePage = lazyNamed(() => import('@/features/submission-review'), 'ReviewQueuePage');
const SubmissionReviewPage = lazyNamed(
  () => import('@/features/submission-review'),
  'SubmissionReviewPage',
);
const MentorHuddlesPage = lazyNamed(() => import('@/features/mentor-huddles'), 'MentorHuddlesPage');

function suspended(element: React.ReactNode) {
  return <Suspense fallback={<PortalRouteSkeleton />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <HomePage /> },
      {
        path: '/admin',
        element: <RequireRole roles={ADMIN_ROLES} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminDashboardPage /> },
              { path: 'organizations', element: <OrganizationsListPage /> },
              { path: 'organizations/new', element: <OrganizationCreatePage /> },
              { path: 'organizations/:orgId', element: <OrganizationDetailPage /> },
              { path: 'academies', element: <AcademiesListPage /> },
              { path: 'academies/new', element: <AcademyCreatePage /> },
              { path: 'academies/:academyId', element: <AcademyDetailPage /> },
              { path: 'fellowships', element: <FellowshipsListPage /> },
              { path: 'fellowships/new', element: <FellowshipCreatePage /> },
              { path: 'fellowships/:fellowshipId', element: <FellowshipDetailPage /> },
              { path: 'fellowships/:fellowshipId/tracks', element: <LearningTracksListPage /> },
              {
                path: 'fellowships/:fellowshipId/tracks/new',
                element: <LearningTrackCreatePage />,
              },
              { path: 'tracks/:trackId', element: <LearningTrackDetailPage /> },
              { path: 'tracks/:trackId/courses/new', element: <CourseCreatePage /> },
              { path: 'courses/:courseId', element: <CourseDetailPage /> },
              { path: 'courses/:courseId/modules/new', element: <WeeklyModuleCreatePage /> },
              { path: 'modules/:moduleId', element: <WeeklyModuleDetailPage /> },
              { path: 'modules/:moduleId/lessons/new', element: <LessonCreatePage /> },
              { path: 'lessons/:lessonId', element: <LessonDetailPage /> },
              { path: 'modules/:moduleId/resources/new', element: <LearningResourceCreatePage /> },
              { path: 'learning-resources/:resourceId', element: <LearningResourceDetailPage /> },
              { path: 'modules/:moduleId/tasks/new', element: <PracticalTaskCreatePage /> },
              { path: 'practical-tasks/:taskId', element: <PracticalTaskDetailPage /> },
              { path: 'cohorts', element: <CohortsListPage /> },
              { path: 'cohorts/new', element: <CohortCreatePage /> },
              { path: 'cohorts/:cohortId', element: <CohortDetailPage /> },
              { path: 'users', element: <AdminUsersListPage /> },
              { path: 'users/:userId', element: <AdminUserDetailPage /> },
              { path: 'roles', element: <RolesListPage /> },
              { path: 'roles/new', element: <RoleCreatePage /> },
              { path: 'roles/permission-matrix', element: <PermissionMatrixPage /> },
              { path: 'roles/:roleId', element: <RoleDetailPage /> },
              { path: 'audit', element: <AuditCenterPage /> },
              { path: 'reports', element: <ReportsPage /> },
              { path: 'announcements', element: <AnnouncementsPage /> },
              { path: 'certificates', element: <CertificatesPage /> },
              { path: 'applications', element: <AdminCohortApplicationsListPage /> },
              { path: 'applications/:id', element: <AdminCohortApplicationDetailPage /> },
              { path: 'settings', element: <AdminSettingsPage /> },
            ],
          },
        ],
      },
      {
        path: '/portal',
        element: <RequireRole roles={['STUDENT']} />,
        children: [
          {
            element: <PortalLayout />,
            children: [
              { index: true, element: suspended(<PortalDashboardPage />) },
              { path: 'weekly-learning', element: suspended(<WeeklyLearningPage />) },
              { path: 'weekly-learning/:moduleId', element: suspended(<WeeklyModulePage />) },
              { path: 'lessons/:lessonId', element: suspended(<LessonReaderPage />) },
              { path: 'resources', element: suspended(<LearningResourcesPortalPage />) },
              { path: 'practical-tasks', element: suspended(<PracticalTasksPortalPage />) },
              {
                path: 'practical-tasks/:taskId',
                element: suspended(<PracticalTaskPortalDetailPage />),
              },
              { path: 'progress', element: suspended(<ProgressCenterPage />) },
              { path: 'portfolio', element: suspended(<PortfolioPage />) },
              { path: 'portfolio/new', element: suspended(<PortfolioProjectCreatePage />) },
              { path: 'portfolio/:id', element: suspended(<PortfolioProjectEditPage />) },
              { path: 'profile', element: suspended(<ProfilePage />) },
              { path: 'settings', element: suspended(<SettingsPage />) },
              { path: 'notifications', element: suspended(<NotificationsPage />) },
              { path: 'register', element: suspended(<StudentRegisterPage />) },
            ],
          },
        ],
      },
      {
        path: '/mentor',
        element: <RequireRole roles={['MENTOR']} />,
        children: [
          {
            element: <MentorLayout />,
            children: [
              { index: true, element: suspended(<MentorDashboardPage />) },
              { path: 'cohorts', element: suspended(<MentorCohortsListPage />) },
              { path: 'cohorts/:cohortId', element: suspended(<CohortWorkspacePage />) },
              { path: 'students/:enrollmentId', element: suspended(<StudentWorkspacePage />) },
              { path: 'review-queue', element: suspended(<ReviewQueuePage />) },
              { path: 'submissions/:submissionId', element: suspended(<SubmissionReviewPage />) },
              { path: 'huddles', element: suspended(<MentorHuddlesPage />) },
              { path: 'settings', element: suspended(<SettingsPage variant="mentor" />) },
            ],
          },
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
  { path: '/certificates/verify', element: <CertificateVerifyPage /> },
  { path: '/certificates/verify/:code', element: <CertificateVerifyPage /> },
  { path: '/apply', element: <ApplyPage /> },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
