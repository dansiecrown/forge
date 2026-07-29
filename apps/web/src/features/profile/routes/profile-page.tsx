import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ProfileForm } from '../components/profile-form';

export function ProfilePage() {
  return (
    <div>
      <AdminPageHeader title="Profile" description="Tell your mentors and peers about yourself." />
      <ProfileForm />
    </div>
  );
}
