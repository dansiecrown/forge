import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { ApiError } from '@/api/client';
import { useResetPassword } from '../hooks/use-reset-password';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas/auth-schemas';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const resetPassword = useResetPassword();
  const form = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!token) return;
    await resetPassword.mutateAsync({ token, newPassword: values.newPassword });
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid reset link</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="danger">
            This password reset link is missing its token. Request a new one below.
          </Alert>
          <p className="mt-4 text-center text-sm">
            <Link to="/forgot-password" className="text-brand hover:underline">
              Request a new link
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (resetPassword.isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password updated</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="success">
            Your password has been changed. Sign in with your new password.
          </Alert>
          <p className="mt-4 text-center text-sm">
            <Link to="/sign-in" className="text-brand hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const apiErrorMessage =
    resetPassword.error instanceof ApiError
      ? resetPassword.error.message
      : resetPassword.error
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Use at least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {apiErrorMessage ? <Alert variant="danger">{apiErrorMessage}</Alert> : null}
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            autoFocus
            error={form.formState.errors.newPassword?.message}
            {...form.register('newPassword')}
          />
          <FormField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.confirmPassword?.message}
            {...form.register('confirmPassword')}
          />
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
