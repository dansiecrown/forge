import { Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useActiveOrganization } from '@/contexts/organization-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useAdminUser,
  useAdminUserActions,
  useLoginHistory,
  useUserSessions,
} from '../hooks/use-admin-users';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  invited: 'neutral',
  active: 'success',
  suspended: 'warning',
  deactivated: 'danger',
};

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { activeOrganizationId } = useActiveOrganization();
  const { data: user, isLoading, error } = useAdminUser(userId);
  const actions = useAdminUserActions(userId ?? '', activeOrganizationId ?? '');
  const permissions = usePermissions();
  const sessions = useUserSessions(
    userId ?? '',
    activeOrganizationId ?? '',
    permissions.has('user.sessions.manage'),
  );
  const loginHistory = useLoginHistory(
    userId ?? '',
    activeOrganizationId ?? '',
    permissions.has('audit.read'),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <Alert variant="danger">
        {error instanceof ApiError ? error.message : 'User not found.'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={user.displayName}
        description={
          <>
            <Link to="/admin/users" className="text-brand hover:underline">
              Users
            </Link>{' '}
            / {user.emailCanonical}
          </>
        }
        action={<Badge tone={STATUS_TONE[user.status]}>{user.status}</Badge>}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle as="h2">Account actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {user.status === 'active' && permissions.has('user.suspend') ? (
              <Button
                variant="secondary"
                loading={actions.suspend.isPending}
                onClick={() => actions.suspend.mutate()}
              >
                Suspend
              </Button>
            ) : null}
            {user.status === 'suspended' && permissions.has('user.reactivate') ? (
              <Button
                variant="secondary"
                loading={actions.reactivate.isPending}
                onClick={() => actions.reactivate.mutate()}
              >
                Reactivate
              </Button>
            ) : null}
            {permissions.has('user.mfa.reset') ? (
              <Button
                variant="secondary"
                loading={actions.mfaReset.isPending}
                onClick={() => actions.mfaReset.mutate()}
              >
                Reset MFA
              </Button>
            ) : null}
            {permissions.has('user.password.force_reset') ? (
              <Button
                variant="secondary"
                loading={actions.passwordReset.isPending}
                onClick={() => actions.passwordReset.mutate()}
              >
                Force password reset
              </Button>
            ) : null}
            {permissions.has('user.sessions.manage') ? (
              <Button
                variant="destructive"
                loading={actions.revokeAll.isPending}
                onClick={() => actions.revokeAll.mutate()}
              >
                Revoke all sessions
              </Button>
            ) : null}
          </div>
          {!permissions.isSuperAdmin &&
          !permissions.has('user.suspend') &&
          !permissions.has('user.mfa.reset') ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Your role can view this account but not modify it.
            </p>
          ) : null}
          {actions.mfaReset.isSuccess ? (
            <p className="mt-3 text-sm text-success">MFA has been reset for this account.</p>
          ) : null}
          {actions.passwordReset.isSuccess ? (
            <p className="mt-3 text-sm text-success">
              A password-reset link has been sent to this user.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {permissions.has('user.sessions.manage') ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle as="h2">Active sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.data?.items.length ? (
              <ul className="space-y-3">
                {sessions.data.items.map((session) => (
                  <li key={session.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {session.deviceLabel ?? 'Unknown device'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        Issued {new Date(session.issuedAt).toLocaleString()}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => sessions.revoke.mutate(session.id)}
                        loading={sessions.revoke.isPending}
                      >
                        Revoke
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No active sessions.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {permissions.has('audit.read') ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle as="h2">Login history</CardTitle>
          </CardHeader>
          <CardContent>
            {loginHistory.data?.items.length ? (
              <ul className="space-y-2">
                {loginHistory.data.items.map((entry) => (
                  <li key={entry.id} className="text-sm text-muted-foreground">
                    {new Date(entry.occurredAt).toLocaleString()} — {entry.outcome}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No login history recorded.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
