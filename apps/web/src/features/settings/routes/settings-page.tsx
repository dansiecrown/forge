import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Tabs } from '@/components/ui/tabs';
import { ProfileForm } from '@/features/profile';
import { AccountTab } from '../components/account-tab';
import { AppearanceTab } from '../components/appearance-tab';
import { NotificationsTab } from '../components/notifications-tab';
import { SecurityTab } from '../components/security-tab';

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'security', label: 'Security' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'account', label: 'Account' },
];

export function SettingsPage({ variant = 'student' }: { variant?: 'student' | 'mentor' }) {
  const [tab, setTab] = useState('profile');

  return (
    <div>
      <AdminPageHeader title="Settings" />
      <Tabs items={TABS} value={tab} onChange={setTab} className="mb-6" />
      <div role="tabpanel">
        {tab === 'profile' ? <ProfileForm variant={variant} /> : null}
        {tab === 'security' ? <SecurityTab /> : null}
        {tab === 'appearance' ? <AppearanceTab /> : null}
        {tab === 'notifications' ? <NotificationsTab /> : null}
        {tab === 'account' ? <AccountTab /> : null}
      </div>
    </div>
  );
}
