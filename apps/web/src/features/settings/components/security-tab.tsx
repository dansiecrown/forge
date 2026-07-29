import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle as="h2">Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="max-w-sm space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
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

  if (enrollMfa.isSuccess && !confirmEnrollment.isSuccess) {
    const enrollment = enrollMfa.data;
    return (
      <Card>
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
    <Card>
      <CardHeader>
        <CardTitle as="h2">Multi-factor authentication</CardTitle>
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
              loading={disableMfa.isPending}
              onClick={() => disableMfa.mutate({ code: disableCode })}
            >
              Disable MFA
            </Button>
          </div>
        ) : null}
        {disableMfa.error instanceof ApiError ? (
          <Alert variant="danger">{disableMfa.error.message}</Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SessionsSection() {
  const { data: sessions } = useSessions();
  const revokeSession = useRevokeSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Active sessions</CardTitle>
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
                  <Button
                    variant="tertiary"
                    loading={revokeSession.isPending}
                    onClick={() => revokeSession.mutate(session.id)}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
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
