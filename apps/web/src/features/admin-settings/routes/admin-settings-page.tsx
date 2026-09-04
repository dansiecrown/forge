import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { SelectField } from '@/components/select-field';
import { Switch } from '@/components/ui/switch';
import { getSystemSettings, updateSystemSettings } from '../api/admin-settings-api';

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getSystemSettings,
  });

  const [platformName, setPlatformName] = useState('');
  const [defaultTheme, setDefaultTheme] = useState('dark');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    if (data) {
      setPlatformName(data.platformName);
      setDefaultTheme(data.defaultTheme);
      setMaintenanceMode(data.maintenanceMode);
      setRegistrationOpen(data.registrationOpen);
    }
  }, [data]);

  const update = useMutation({
    mutationFn: () =>
      updateSystemSettings(
        { platformName, defaultTheme, maintenanceMode, registrationOpen },
        data?.version as number,
      ),
    onSuccess: (updated) => queryClient.setQueryData(['admin-settings'], updated),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || !data) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Could not load system settings.'}
      </Alert>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="System Settings"
        description="Platform-wide branding, theme default, and maintenance/registration policy — Super Admin only."
      />
      <Card>
        <CardHeader>
          <CardTitle as="h2">Platform configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {update.error instanceof ApiError ? (
            <Alert variant="danger">{update.error.message}</Alert>
          ) : null}
          <form
            className="flex flex-wrap gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate();
            }}
            noValidate
          >
            <FormField
              label="Platform name"
              name="platformName"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
            />
            <SelectField
              label="Default theme"
              name="defaultTheme"
              value={defaultTheme}
              onChange={(e) => setDefaultTheme(e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </SelectField>
            <div className="flex w-full items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Maintenance mode</p>
                <p className="text-sm text-muted-foreground">
                  Displays a maintenance notice platform-wide.
                </p>
              </div>
              <Switch
                checked={maintenanceMode}
                onChange={setMaintenanceMode}
                label="Maintenance mode"
              />
            </div>
            <div className="flex w-full items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Registration open</p>
                <p className="text-sm text-muted-foreground">
                  Allow new organizations/users to register.
                </p>
              </div>
              <Switch
                checked={registrationOpen}
                onChange={setRegistrationOpen}
                label="Registration open"
              />
            </div>
            <div className="flex w-full justify-end pt-2">
              <Button type="submit" loading={update.isPending}>
                Save settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
