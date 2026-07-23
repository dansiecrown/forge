import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { useSession } from '@/contexts/session-context';
import { ApiError } from '@/api/client';
import {
  mfaCodeSchema,
  type MfaCodeFormValues,
  signInSchema,
  type SignInFormValues,
} from '../schemas/auth-schemas';

export function SignInPage() {
  const { login, completeMfaLogin } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const credentialsForm = useForm<SignInFormValues>({ resolver: zodResolver(signInSchema) });
  const mfaForm = useForm<MfaCodeFormValues>({ resolver: zodResolver(mfaCodeSchema) });

  async function onSubmitCredentials(values: SignInFormValues) {
    setFormError(null);
    try {
      const result = await login(values.email, values.password);
      if (result.mfaRequired) {
        setMfaChallengeToken(result.mfaChallengeToken);
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  }

  async function onSubmitMfaCode(values: MfaCodeFormValues) {
    if (!mfaChallengeToken) return;
    setFormError(null);
    try {
      await completeMfaLogin(mfaChallengeToken, values.code);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  }

  if (mfaChallengeToken) {
    return (
      <Card glass>
        <CardHeader>
          <CardTitle>Enter your verification code</CardTitle>
          <CardDescription>
            Open your authenticator app and enter the current 6-digit code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={mfaForm.handleSubmit(onSubmitMfaCode)} noValidate>
            {formError ? <Alert variant="danger">{formError}</Alert> : null}
            <FormField
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              error={mfaForm.formState.errors.code?.message}
              {...mfaForm.register('code')}
            />
            <Button type="submit" className="w-full" loading={mfaForm.formState.isSubmitting}>
              Verify and sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card glass>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your Project Forge account email and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)}
          noValidate
        >
          {formError ? <Alert variant="danger">{formError}</Alert> : null}
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            error={credentialsForm.formState.errors.email?.message}
            {...credentialsForm.register('email')}
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={credentialsForm.formState.errors.password?.message}
            {...credentialsForm.register('password')}
          />
          <Button type="submit" className="w-full" loading={credentialsForm.formState.isSubmitting}>
            Sign in
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/forgot-password" className="text-brand hover:underline">
              Forgot your password?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
