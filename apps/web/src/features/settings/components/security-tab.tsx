import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Laptop2, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import {
  useChangePassword,
  useConfirmMfaEnrollment,
  useDisableMfa,
  useEnrollMfa,
  useMe,
  useRevokeSession,
  useSessions,
} from '../hooks/use-settings';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z.string().min(8, 'Must be at least 8 characters.'),
  })
  .required();
type PasswordFormValues = z.infer<typeof passwordSchema>;

function extractSecret(otpauthUri: string): string {
  try {
    return (
      new URL(otpauthUri.replace('otpauth://totp/', 'https://x/')).searchParams.get('secret') ?? ''
    );
  } catch {
    return '';
  }
}

function PasswordSection() {
  const changePassword = useChangePassword();
  const form = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

  async function onSubmit(values: PasswordFormValues) {
    try {
      await changePassword.mutateAsync(values);
      form.reset();
    } catch {
      // surfaced below via changePassword.error
    }
  }

  const errorMessage =
    changePassword.error instanceof ApiError ? changePassword.error.message : null;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <KeyRound className="size-5 text-muted-foreground" aria-hidden="true" />
          Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
          {changePassword.isSuccess ? <Alert variant="success">Password updated.</Alert> : null}
          <FormField
            label="Current password"
            type="password"
            error={form.formState.errors.currentPassword?.message}
            {...form.register('currentPassword')}
          />
          <FormField
            label="New password"
            type="password"
            error={form.formState.errors.newPassword?.message}
            {...form.register('newPassword')}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={changePassword.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MfaSection() {
  const { data: me } = useMe();
  const enrollMfa = useEnrollMfa();
  const confirmEnrollment = useConfirmMfaEnrollment();
  const disableMfa = useDisableMfa();
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  if (enrollMfa.isSuccess && !confirmEnrollment.isSuccess) {
    const enrollment = enrollMfa.data;
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle as="h2">Enable multi-factor authentication</CardTitle>
          <CardDescription>
            Add this account to your authenticator app using the setup key below, then enter the
            6-digit code it generates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-control border border-border bg-surface-2 px-3 py-2 font-mono text-sm">
            {extractSecret(enrollment.otpauthUri)}
          </div>
          <FormField
            label="Verification code"
            name="mfaCode"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={8}
          />
          {confirmEnrollment.error instanceof ApiError ? (
            <Alert variant="danger">{confirmEnrollment.error.message}</Alert>
          ) : null}
          <Button
            loading={confirmEnrollment.isPending}
            onClick={() => confirmEnrollment.mutate({ factorId: enrollment.factorId, code })}
          >
            Confirm and enable
          </Button>
          <p className="text-xs text-muted-foreground">
            Save your recovery codes somewhere safe: {enrollment.recoveryCodes.join(', ')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-muted-foreground" aria-hidden="true" />
          Multi-factor authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge tone={me?.mfaEnabled ? 'success' : 'neutral'}>
            {me?.mfaEnabled ? 'Enabled' : 'Not enabled'}
          </Badge>
          {!me?.mfaEnabled ? (
            <Button
              variant="secondary"
              loading={enrollMfa.isPending}
              onClick={() => enrollMfa.mutate()}
            >
              Enable MFA
            </Button>
          ) : null}
        </div>
        {me?.mfaEnabled ? (
          <div className="flex items-end gap-3">
            <FormField
              label="Code or recovery code to disable"
              name="disableCode"
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value)}
              className="max-w-[220px]"
            />
            <Button
              variant="destructive"
              disabled={!disableCode}
              onClick={() => setConfirmingDisable(true)}
            >
              Disable MFA
            </Button>
          </div>
        ) : null}
        {disableMfa.error instanceof ApiError ? (
          <Alert variant="danger">{disableMfa.error.message}</Alert>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={confirmingDisable}
        onClose={() => setConfirmingDisable(false)}
        onConfirm={async () => {
          try {
            await disableMfa.mutateAsync({ code: disableCode });
            setConfirmingDisable(false);
          } catch {
            // surfaced above via disableMfa.error
          }
        }}
        loading={disableMfa.isPending}
        title="Disable multi-factor authentication?"
        description="Your account will only be protected by your password from then on."
        confirmLabel="Disable MFA"
      />
    </Card>
  );
}

function SessionsSection() {
  const { data: sessions } = useSessions();
  const revokeSession = useRevokeSession();
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <Laptop2 className="size-5 text-muted-foreground" aria-hidden="true" />
          Active sessions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!sessions || sessions.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.items.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {session.device}
                  {session.current ? (
                    <Badge tone="brand" className="ml-2">
                      this device
                    </Badge>
                  ) : null}
                </span>
                {!session.current ? (
                  <Button variant="tertiary" onClick={() => setRevokeSessionId(session.id)}>
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={revokeSessionId !== null}
        onClose={() => setRevokeSessionId(null)}
        onConfirm={async () => {
          if (!revokeSessionId) return;
          try {
            await revokeSession.mutateAsync(revokeSessionId);
            setRevokeSessionId(null);
          } catch {
            // surfaced via revokeSession.error, not currently displayed here
          }
        }}
        loading={revokeSession.isPending}
        title="Sign out that device?"
        description="It will need to sign in again to continue."
        confirmLabel="Revoke"
      />
    </Card>
  );
}

export function SecurityTab() {
  return (
    <div className="space-y-6">
      <PasswordSection />
      <MfaSection />
      <SessionsSection />
    </div>
  );
}
