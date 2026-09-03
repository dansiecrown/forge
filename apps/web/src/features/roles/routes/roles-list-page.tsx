import { Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Role } from '@forge/api-contract';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { useRolesList } from '../hooks/use-roles';

const columns: DataTableColumn<Role>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  { key: 'key', header: 'Key', render: (row) => row.key },
  {
    key: 'scopeType',
    header: 'Scope',
    render: (row) => <Badge tone="neutral">{row.scopeType}</Badge>,
  },
  {
    key: 'isSystem',
    header: 'Type',
    render: (row) => (
      <Badge tone={row.isSystem ? 'brand' : 'neutral'}>{row.isSystem ? 'System' : 'Custom'}</Badge>
    ),
  },
  {
    key: 'permissions',
    header: 'Permissions',
    render: (row) => row.rolePermissions.length,
  },
];

export function RolesListPage() {
  const navigate = useNavigate();
  const { data: roles, isLoading, error } = useRolesList();
  const permissions = usePermissions();

  return (
    <div>
      <AdminPageHeader
        title="Roles & Permissions"
        description="View, create, clone, and manage role permission grants."
        action={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate('/admin/roles/permission-matrix')}>
              Permission matrix
            </Button>
            {permissions.has('role.create') ? (
              <Button onClick={() => navigate('/admin/roles/new')}>
                <Plus className="size-4" aria-hidden="true" />
                New role
              </Button>
            ) : null}
          </div>
        }
      />
      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={roles ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          error={error as Error | null}
          emptyTitle="No roles yet"
          onRowClick={(row) => navigate(`/admin/roles/${row.id}`)}
        />
      )}
    </div>
  );
}
