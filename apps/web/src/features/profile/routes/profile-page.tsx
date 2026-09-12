import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DefinitionList } from '@/components/admin/definition-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyEnrollment } from '@/contexts/enrollment-context';
import { ProfileForm } from '../components/profile-form';

/** Read-only — a student doesn't edit their own Organization/Academy/
 * Fellowship/Cohort/Track assignment, so this has no Edit action, unlike
 * every other card on this page. Names are resolved server-side onto `GET
 * /enrollments/me` — see docs/adr/0015-name-first-display.md. */
function ProgramCard() {
  const { enrollment } = useMyEnrollment();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Your program</CardTitle>
      </CardHeader>
      <CardContent>
        <DefinitionList
          items={[
            { label: 'Organization', value: enrollment?.organizationName },
            { label: 'Academy', value: enrollment?.academyName },
            { label: 'Fellowship', value: enrollment?.fellowshipTitle },
            { label: 'Cohort', value: enrollment?.cohortName },
            { label: 'Learning track', value: enrollment?.currentLearningTrackName },
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Profile" description="Tell your mentors and peers about yourself." />
      <ProgramCard />
      <ProfileForm />
    </div>
  );
}
