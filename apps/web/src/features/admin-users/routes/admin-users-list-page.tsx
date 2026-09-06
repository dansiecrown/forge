import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminUser } from '../api/admin-users-api';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';
import { ListToolbar } from '@/components/admin/list-toolbar';
import { LoadMore } from '@/components/admin/load-more';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/select-field';
import { useToast } from '@/components/ui/toast';
import { useAcademyOptions } from '@/features/academies';
import { useRolesList } from '@/features/roles';
import { usePermissions } from '@/hooks/use-permissions';
import { useAdminUsersList, useCreateUser, useInviteUser } from '../hooks/use-admin-users';

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
  const permissions = usePermissions();
  const [q, setQ] = useState('');
  const { rows, isLoading, error, hasMore, loadMore } = useAdminUsersList(q);

  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const roles = useRolesList();
  const inviteUser = useInviteUser();

  const [adding, setAdding] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addRoles, setAddRoles] = useState<Set<string>>(new Set());
  const [addAcademyId, setAddAcademyId] = useState('');
  const createUser = useCreateUser();
  const academies = useAcademyOptions();
  const toast = useToast();

  function closeInvite() {
    setInviting(false);
    setEmail('');
    setDisplayName('');
    setSelectedRoles(new Set());
    inviteUser.reset();
  }

  function toggleRole(key: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onInvite() {
    try {
      await inviteUser.mutateAsync({ email, displayName, roles: Array.from(selectedRoles) });
      closeInvite();
    } catch {
      // surfaced below via inviteUser.error
    }
  }

  const assignableRoles = (roles.data ?? []).filter(
    (role) => role.scopeType !== 'platform' && role.status === 'active',
  );

  function closeAdd() {
    setAdding(false);
    setAddEmail('');
    setAddUsername('');
    setAddPassword('');
    setAddDisplayName('');
    setAddRoles(new Set());
    setAddAcademyId('');
    createUser.reset();
  }

  function toggleAddRole(key: string) {
    setAddRoles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (key !== 'ACADEMY_ADMIN' && !next.has('ACADEMY_ADMIN')) setAddAcademyId('');
      return next;
    });
  }

  const needsAcademy = addRoles.has('ACADEMY_ADMIN');

  async function onAdd() {
    try {
      const result = await createUser.mutateAsync({
        email: addEmail,
        username: addUsername,
        password: addPassword,
        displayName: addDisplayName,
        roleKeys: Array.from(addRoles),
        academyId: needsAcademy ? addAcademyId : undefined,
      });
      toast.success(`${result.displayName} can log in immediately with the password you set.`);
      closeAdd();
    } catch {
      // surfaced below via createUser.error
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Search, suspend, reactivate, and manage sessions for any user."
        action={
          permissions.has('membership.invite') ? (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setInviting(true)}>
                Invite user
              </Button>
              <Button onClick={() => setAdding(true)}>Add user</Button>
            </div>
          ) : null
        }
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

      <Dialog
        open={inviting}
        onClose={closeInvite}
        title="Invite a new user"
        description="They're added to this organization; roles can be changed any time from their profile."
      >
        <form
          className="flex flex-wrap gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onInvite();
          }}
          noValidate
        >
          {inviteUser.error instanceof ApiError ? (
            <Alert variant="danger" className="w-full">
              {inviteUser.error.message}
            </Alert>
          ) : null}
          <FormField
            label="Display name"
            name="displayName"
            autoFocus
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {assignableRoles.length > 0 ? (
            <div className="w-full space-y-1.5">
              <Label>Roles</Label>
              <div className="space-y-2">
                {assignableRoles.map((role) => (
                  <label key={role.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={selectedRoles.has(role.key)}
                      onChange={() => toggleRole(role.key)}
                    />
                    {role.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex w-full justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeInvite}>
              Cancel
            </Button>
            <Button type="submit" loading={inviteUser.isPending} disabled={!email || !displayName}>
              Send invite
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={adding}
        onClose={closeAdd}
        title="Add a new user"
        description="You set their password directly — they can log in immediately, no email required."
      >
        <form
          className="flex flex-wrap gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onAdd();
          }}
          noValidate
        >
          {createUser.error instanceof ApiError ? (
            <Alert variant="danger" className="w-full">
              {createUser.error.message}
            </Alert>
          ) : null}
          <FormField
            label="Display name"
            name="addDisplayName"
            autoFocus
            required
            value={addDisplayName}
            onChange={(event) => setAddDisplayName(event.target.value)}
          />
          <FormField
            label="Email"
            name="addEmail"
            type="email"
            required
            value={addEmail}
            onChange={(event) => setAddEmail(event.target.value)}
          />
          <FormField
            label="Username"
            name="addUsername"
            required
            placeholder="lowercase, no spaces"
            value={addUsername}
            onChange={(event) => setAddUsername(event.target.value.toLowerCase())}
          />
          <FormField
            label="Password"
            name="addPassword"
            type="password"
            required
            minLength={8}
            value={addPassword}
            onChange={(event) => setAddPassword(event.target.value)}
          />
          {assignableRoles.length > 0 ? (
            <div className="w-full space-y-1.5">
              <Label>Roles</Label>
              <div className="space-y-2">
                {assignableRoles.map((role) => (
                  <label key={role.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={addRoles.has(role.key)}
                      onChange={() => toggleAddRole(role.key)}
                    />
                    {role.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {needsAcademy ? (
            <SelectField
              label="Academy (jurisdiction)"
              name="addAcademyId"
              fullWidth
              required
              value={addAcademyId}
              onChange={(event) => setAddAcademyId(event.target.value)}
            >
              <option value="" disabled>
                Select an academy…
              </option>
              {(academies.data?.items ?? []).map((academy) => (
                <option key={academy.id} value={academy.id}>
                  {academy.name}
                </option>
              ))}
            </SelectField>
          ) : null}
          <div className="flex w-full justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeAdd}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createUser.isPending}
              disabled={
                !addEmail ||
                !addUsername ||
                !addPassword ||
                !addDisplayName ||
                addRoles.size === 0 ||
                (needsAcademy && !addAcademyId)
              }
            >
              Create account
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
