import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/api/client';
import { useVerifyEmail } from '../hooks/use-verify-email';

/** No form — the link itself carries the token, so verification just runs
 * once on mount. Mirrors `ResetPasswordPage`'s invalid-link/success shape. */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verifyEmailMutation = useVerifyEmail();

  useEffect(() => {
    if (token) {
      verifyEmailMutation.mutate({ token });
    }
    // Runs once for the token this page loaded with — deliberately omits
    // `verifyEmailMutation` from deps (a new object each render) so this
    // never re-fires on the mutation's own state changes.
  }, [token]);

  if (!token) {
    return (
      <Card glass>
        <CardHeader>
          <CardTitle>Invalid verification link</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="danger">This email verification link is missing its token.</Alert>
          <p className="mt-4 text-center text-sm">
            <Link to="/sign-in" className="text-brand hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (verifyEmailMutation.isSuccess) {
    return (
      <Card glass>
        <CardHeader>
          <CardTitle>Email verified</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="success">Your email address has been verified.</Alert>
          <p className="mt-4 text-center text-sm">
            <Link to="/sign-in" className="text-brand hover:underline">
              Continue to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (verifyEmailMutation.isError) {
    const message =
      verifyEmailMutation.error instanceof ApiError
        ? verifyEmailMutation.error.message
        : 'Something went wrong. Please try again.';
    return (
      <Card glass>
        <CardHeader>
          <CardTitle>Couldn't verify email</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="danger">{message}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card glass>
      <CardHeader>
        <CardTitle>Verifying your email…</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </CardContent>
    </Card>
  );
}
