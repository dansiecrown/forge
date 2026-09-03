import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { ActionsMenu, type ActionsMenuItem } from '@/components/admin/actions-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useActiveOrganization } from '@/contexts/organization-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useAdminUser,
  useAdminUserActions,
  useLoginHistory,
  useUserSessions,
} from '../hooks/use-admin-users';

type PendingAction = 'suspend' | 'mfaReset' | 'passwordReset' | 'revokeAll';

const CONFIRM_COPY: Record<
  PendingAction,
  { title: string; description: string; confirmLabel: string }
> = {
  suspend: {
    title: 'Suspend this account?',
    description: 'They will immediately lose access until reactivated.',
    confirmLabel: 'Suspend',
  },
  mfaReset: {
    title: 'Reset multi-factor authentication?',
    description: 'This disables MFA without proof of possession. The user will need to re-enroll.',
    confirmLabel: 'Reset MFA',
  },
  passwordReset: {
    title: 'Force a password reset?',
    description:
      'A password-reset link will be sent to this user, invalidating their current password.',
    confirmLabel: 'Send reset link',
  },
  revokeAll: {
    title: 'Revoke all sessions?',
    description: 'This immediately signs the user out everywhere.',
    confirmLabel: 'Revoke all',
  },
};

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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);

  const actionMutation =
    pendingAction === 'suspend'
      ? actions.suspend
      : pendingAction === 'mfaReset'
        ? actions.mfaReset
        : pendingAction === 'passwordReset'
          ? actions.passwordReset
          : pendingAction === 'revokeAll'
            ? actions.revokeAll
            : null;

  async function onConfirmAction() {
    if (!actionMutation) return;
    try {
      await actionMutation.mutateAsync();
      setPendingAction(null);
    } catch {
      // surfaced below via actionMutation.error
    }
  }

  async function onConfirmRevokeSession() {
    if (!revokeSessionId) return;
    try {
      await sessions.revoke.mutateAsync(revokeSessionId);
      setRevokeSessionId(null);
    } catch {
      // surfaced below via sessions.revoke.error
    }
  }

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

  const actionItems: ActionsMenuItem[] = [];
  if (user.status === 'active' && permissions.has('user.suspend')) {
    actionItems.push({ label: 'Suspend', onSelect: () => setPendingAction('suspend') });
  }
  if (user.status === 'suspended' && permissions.has('user.reactivate')) {
    actionItems.push({
      label: 'Reactivate',
      loading: actions.reactivate.isPending,
      onSelect: () => actions.reactivate.mutate(),
    });
  }
  if (permissions.has('user.mfa.reset')) {
    actionItems.push({ label: 'Reset MFA', onSelect: () => setPendingAction('mfaReset') });
  }
  if (permissions.has('user.password.force_reset')) {
    actionItems.push({
      label: 'Force password reset',
      onSelect: () => setPendingAction('passwordReset'),
    });
  }
  if (permissions.has('user.sessions.manage')) {
    actionItems.push({
      label: 'Revoke all sessions',
      tone: 'danger',
      onSelect: () => setPendingAction('revokeAll'),
    });
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
        action={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[user.status]}>{user.status}</Badge>
            <ActionsMenu items={actionItems} />
          </div>
        }
      />

      {!permissions.isSuperAdmin &&
      !permissions.has('user.suspend') &&
      !permissions.has('user.mfa.reset') ? (
        <p className="text-sm text-muted-foreground">
          Your role can view this account but not modify it.
        </p>
      ) : null}
      {actions.mfaReset.isSuccess ? (
        <Alert variant="success">MFA has been reset for this account.</Alert>
      ) : null}
      {actions.passwordReset.isSuccess ? (
        <Alert variant="success">A password-reset link has been sent to this user.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {permissions.has('user.sessions.manage') ? (
          <Card>
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
                        <Button variant="secondary" onClick={() => setRevokeSessionId(session.id)}>
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
          <Card>
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

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={onConfirmAction}
        loading={actionMutation?.isPending ?? false}
        error={actionMutation?.error instanceof ApiError ? actionMutation.error.message : null}
        title={pendingAction ? CONFIRM_COPY[pendingAction].title : ''}
        description={pendingAction ? CONFIRM_COPY[pendingAction].description : undefined}
        confirmLabel={pendingAction ? CONFIRM_COPY[pendingAction].confirmLabel : 'Confirm'}
        confirmVariant={
          pendingAction === 'revokeAll' || pendingAction === 'suspend' ? 'destructive' : 'primary'
        }
      />

      <ConfirmDialog
        open={revokeSessionId !== null}
        onClose={() => setRevokeSessionId(null)}
        onConfirm={onConfirmRevokeSession}
        loading={sessions.revoke.isPending}
        error={sessions.revoke.error instanceof ApiError ? sessions.revoke.error.message : null}
        title="Revoke this session?"
        description="That device will be signed out immediately."
        confirmLabel="Revoke"
      />
    </div>
  );
}
