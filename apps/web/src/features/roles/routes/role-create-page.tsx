import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { useCreateRole } from '../hooks/use-roles';
import { PermissionCheckboxList } from '../components/permission-checkbox-list';
import { usePermissionMatrix } from '../hooks/use-roles';

export function RoleCreatePage() {
  const navigate = useNavigate();
  const { data: matrix } = usePermissionMatrix();
  const createRole = useCreateRole();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [permissionIds, setPermissionIds] = useState<Set<string>>(new Set());

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await createRole.mutateAsync({
        name,
        key,
        permissionIds: Array.from(permissionIds),
      });
      navigate(`/admin/roles/${created.id}`);
    } catch {
      // surfaced below via createRole.error
    }
  }

  const apiErrorMessage = createRole.error instanceof ApiError ? createRole.error.message : null;

  return (
    <div>
      <AdminPageHeader title="New role" description="Create a custom role for this organization." />
      <Card className="max-w-2xl">
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            {apiErrorMessage ? <Alert variant="danger">{apiErrorMessage}</Alert> : null}
            <FormField
              label="Name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <FormField
              label="Key"
              name="key"
              placeholder="cohort_coordinator"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <PermissionCheckboxList
              permissions={matrix?.permissions ?? []}
              selected={permissionIds}
              onChange={setPermissionIds}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/roles')}>
                Cancel
              </Button>
              <Button type="submit" loading={createRole.isPending}>
                Create role
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
