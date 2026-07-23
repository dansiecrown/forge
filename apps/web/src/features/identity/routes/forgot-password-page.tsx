import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { useForgotPassword } from '../hooks/use-forgot-password';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas/auth-schemas';

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const form = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordFormValues) {
    await forgotPassword.mutateAsync(values);
  }

  if (forgotPassword.isSuccess) {
    return (
      <Card glass>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="success">
            If an account exists for that email, we&apos;ve sent a link to reset the password.
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

  return (
    <Card glass>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>We&apos;ll send a reset link to your account email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            Send reset link
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/sign-in" className="text-brand hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
