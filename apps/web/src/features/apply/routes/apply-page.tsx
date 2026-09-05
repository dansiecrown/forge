import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CatalogPicker, type CatalogSelection } from '../components/catalog-picker';
import { submitProspectApplication } from '../api/prospect-applications-api';
import { usePublicCatalog } from '../hooks/use-public-catalog';

const prospectSchema = z.object({
  prospectDisplayName: z.string().min(1, 'Enter your full name.').max(160),
  prospectEmail: z.string().email('Enter a valid email address.'),
  note: z.string().max(2000).optional(),
});

type ProspectFormValues = z.infer<typeof prospectSchema>;

/** Public, unauthenticated application page — no `ProtectedRoute`. A
 * prospect with no platform account yet browses fellowships an admin has
 * explicitly marked public and applies to one open cohort. Approval
 * (admin-only) creates their account via the existing invite mechanism —
 * see docs/adr/0010-cohort-applications.md. Already have an account?
 * `/sign-in` then `/portal/register` covers the equivalent authenticated
 * flow. */
export function ApplyPage() {
  const { fellowships, isLoading, error } = usePublicCatalog();
  const [selection, setSelection] = useState<CatalogSelection>({
    cohortId: undefined,
    requestedLearningTrackId: undefined,
  });
  const form = useForm<ProspectFormValues>({ resolver: zodResolver(prospectSchema) });

  const submit = useMutation({
    mutationFn: (values: ProspectFormValues) =>
      submitProspectApplication({
        cohortId: selection.cohortId as string,
        requestedLearningTrackId: selection.requestedLearningTrackId,
        prospectDisplayName: values.prospectDisplayName,
        prospectEmail: values.prospectEmail,
        note: values.note,
      }),
  });

  return (
    <main className="min-h-screen bg-canvas px-6 py-12">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Project Forge
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Apply to a fellowship
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Submit your application below. An admin will review it and reach out once it's approved.
            Already have an account?{' '}
            <a href="/sign-in" className="text-brand hover:underline">
              Sign in
            </a>{' '}
            to apply from your student portal instead.
          </p>
        </div>

        <Card glass>
          <CardContent>
            {submit.isSuccess ? (
              <div className="flex items-start gap-3 rounded-control border border-success/40 bg-success/5 p-4 text-success">
                <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium">Application submitted.</p>
                  <p className="text-success/80">
                    We'll email you at {form.getValues('prospectEmail')} once it's reviewed.
                  </p>
                </div>
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit((values) => submit.mutate(values))}
                noValidate
              >
                {error ? (
                  <Alert variant="danger">Could not load open programmes. Try again shortly.</Alert>
                ) : null}
                {!isLoading ? (
                  <CatalogPicker
                    fellowships={fellowships}
                    value={selection}
                    onChange={setSelection}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading open programmes…</p>
                )}

                <FormField
                  label="Full name"
                  error={form.formState.errors.prospectDisplayName?.message}
                  {...form.register('prospectDisplayName')}
                />
                <FormField
                  label="Email"
                  type="email"
                  error={form.formState.errors.prospectEmail?.message}
                  {...form.register('prospectEmail')}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="note">Why do you want to join? (optional)</Label>
                  <Textarea id="note" rows={3} {...form.register('note')} />
                </div>

                {submit.error ? (
                  <Alert variant="danger">
                    {submit.error instanceof ApiError
                      ? submit.error.message
                      : 'Could not submit your application. Try again.'}
                  </Alert>
                ) : null}

                <Button type="submit" loading={submit.isPending} disabled={!selection.cohortId}>
                  Submit application
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
