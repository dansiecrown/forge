import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { ActionsMenu, type ActionsMenuItem } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { usePermissions } from '@/hooks/use-permissions';
import { PermissionCheckboxList } from '../components/permission-checkbox-list';
import {
  useCloneRole,
  usePermissionMatrix,
  useRetireRole,
  useRole,
  useUpdateRolePermissions,
} from '../hooks/use-roles';

export function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { data: role, isLoading, error } = useRole(roleId);
  const { data: matrix } = usePermissionMatrix();
  const updatePermissions = useUpdateRolePermissions(roleId ?? '');
  const cloneRole = useCloneRole();
  const retireRole = useRetireRole();
  const permissions = usePermissions();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cloning, setCloning] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneKey, setCloneKey] = useState('');
  const [confirmingRetire, setConfirmingRetire] = useState(false);

  useEffect(() => {
    if (role) {
      setSelected(new Set(role.rolePermissions.map((rp) => rp.permission.id)));
    }
  }, [role]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !role) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Role not found.'}
      </Alert>
    );
  }

  async function onSave() {
    if (!role) return;
    await updatePermissions.mutateAsync({
      body: { permissionIds: Array.from(selected) },
      version: role.version,
    });
  }

  async function onClone(event: React.FormEvent) {
    event.preventDefault();
    if (!roleId) return;
    const cloned = await cloneRole.mutateAsync({
      roleId,
      body: { name: cloneName, key: cloneKey },
    });
    navigate(`/admin/roles/${cloned.id}`);
  }

  async function onRetire() {
    if (!roleId) return;
    try {
      await retireRole.mutateAsync(roleId);
      navigate('/admin/roles');
    } catch {
      // surfaced below via retireRole.error
    }
  }

  const actionItems: ActionsMenuItem[] =
    !role.isSystem && permissions.has('role.delete')
      ? [{ label: 'Retire role', tone: 'danger', onSelect: () => setConfirmingRetire(true) }]
      : [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={role.name}
        description={
          <>
            <Link to="/admin/roles" className="text-brand hover:underline">
              Roles
            </Link>{' '}
            / {role.key}
          </>
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={role.isSystem ? 'brand' : 'neutral'}>
              {role.isSystem ? 'System' : 'Custom'}
            </Badge>
            <ActionsMenu items={actionItems} />
          </div>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle as="h2">Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {updatePermissions.error instanceof ApiError ? (
            <Alert variant="danger">{updatePermissions.error.message}</Alert>
          ) : null}
          <PermissionCheckboxList
            permissions={matrix?.permissions ?? []}
            selected={selected}
            onChange={setSelected}
            disabled={role.isSystem || !permissions.has('role.update')}
          />
          {!role.isSystem && permissions.has('role.update') ? (
            <div className="mt-4 flex justify-end">
              <Button onClick={onSave} loading={updatePermissions.isPending}>
                Save permissions
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {role.isSystem
                ? 'System role definitions cannot be edited — clone this role to customize it.'
                : 'Your role can view these permissions but not edit them.'}
            </p>
          )}
        </CardContent>
      </Card>

      {permissions.has('role.create') ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle as="h2">Clone this role</CardTitle>
          </CardHeader>
          <CardContent>
            {cloning ? (
              <form className="space-y-3" onSubmit={onClone} noValidate>
                <FormField
                  label="New role name"
                  name="cloneName"
                  autoFocus
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                />
                <FormField
                  label="New role key"
                  name="cloneKey"
                  value={cloneKey}
                  onChange={(e) => setCloneKey(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setCloning(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={cloneRole.isPending}>
                    Clone role
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="secondary" onClick={() => setCloning(true)}>
                Clone role
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmingRetire}
        onClose={() => setConfirmingRetire(false)}
        onConfirm={onRetire}
        loading={retireRole.isPending}
        error={retireRole.error instanceof ApiError ? retireRole.error.message : null}
        title="Retire this role?"
        description="It will no longer be assignable. This only succeeds if no one currently holds it."
        confirmLabel="Retire role"
      />
    </div>
  );
}
