import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminUser } from '../api/admin-users-api';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { LoadMore } from '@/components/admin/load-more';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useAdminUsersList } from '../hooks/use-admin-users';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  invited: 'neutral',
  active: 'success',
  suspended: 'warning',
  deactivated: 'danger',
};

const columns: DataTableColumn<AdminUser>[] = [
  {
    key: 'displayName',
    header: 'Name',
    render: (row) => <span className="font-medium text-foreground">{row.displayName}</span>,
  },
  { key: 'email', header: 'Email', render: (row) => row.emailCanonical },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
  {
    key: 'lastLoginAt',
    header: 'Last login',
    render: (row) => (row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString() : 'Never'),
  },
];

export function AdminUsersListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { rows, isLoading, error, hasMore, loadMore } = useAdminUsersList(q);

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Search, suspend, reactivate, and manage sessions for any user."
      />
      <ListToolbar q={q} onQChange={setQ} searchPlaceholder="Search users…" />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No users found"
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
      />
      <LoadMore hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />
    </div>
  );
}
