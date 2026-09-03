import { useState } from 'react';
import { BadgeCheck, ShieldAlert } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifyCertificate } from '@/features/certificates';

/** Public, unauthenticated certificate verification page — no `ProtectedRoute`,
 * mirrors the auth pages' plain full-screen layout. */
export function CertificateVerifyPage() {
  const { code: codeFromRoute } = useParams<{ code?: string }>();
  const [code, setCode] = useState(codeFromRoute ?? '');
  const [submittedCode, setSubmittedCode] = useState(codeFromRoute ?? '');

  const { data, isLoading, error, isFetched } = useQuery({
    queryKey: ['certificate-verify', submittedCode],
    queryFn: () => verifyCertificate(submittedCode),
    enabled: Boolean(submittedCode),
    retry: false,
  });

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <Card glass className="w-full max-w-md">
        <CardContent>
          <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">
            Verify a certificate
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter the verification code printed on a Project Forge certificate.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedCode(code.trim());
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification code"
              aria-label="Verification code"
            />
            <Button type="submit" loading={isLoading}>
              Verify
            </Button>
          </form>

          {isFetched && !isLoading ? (
            error || !data ? (
              <div className="mt-6 flex items-center gap-3 rounded-control border border-danger/40 bg-danger/5 p-4 text-danger">
                <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
                <p className="text-sm">
                  {error instanceof ApiError
                    ? error.message
                    : 'No issued certificate matches this code.'}
                </p>
              </div>
            ) : (
              <div className="mt-6 flex items-center gap-3 rounded-control border border-success/40 bg-success/5 p-4 text-success">
                <BadgeCheck className="size-5 shrink-0" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium">This certificate is valid.</p>
                  {data.issuedAt ? (
                    <p className="text-success/80">
                      Issued {new Date(data.issuedAt).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
              </div>
            )
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
