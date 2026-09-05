import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { usePermissionMatrix } from '../hooks/use-roles';

export function PermissionMatrixPage() {
  const { data, isLoading, error } = usePermissionMatrix();

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'Could not load the permission matrix.'}
      </Alert>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Permission matrix"
        description={
          <>
            <Link to="/admin/roles" className="text-brand hover:underline">
              Roles
            </Link>{' '}
            / Every role × every permission
          </>
        }
      />
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="sticky left-0 bg-surface px-4 py-3">
                Permission
              </th>
              {data.roles.map((role) => (
                <th key={role.id} scope="col" className="px-3 py-3 text-center">
                  {role.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.permissions.map((permission) => (
              <tr key={permission.id} className="border-b border-border last:border-0">
                <td className="sticky left-0 bg-surface px-4 py-2 font-mono text-xs text-foreground">
                  {permission.key}
                </td>
                {data.roles.map((role) => (
                  <td key={role.id} className="px-3 py-2 text-center">
                    {role.grantedPermissionIds.includes(permission.id) ? (
                      <span className="text-success">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
