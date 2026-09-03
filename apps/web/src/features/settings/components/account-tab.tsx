import { useEffect } from 'react';
import { IdCard } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { useMe, useUpdateMe } from '../hooks/use-settings';

interface AccountFormValues {
  displayName: string;
  timezone: string;
  locale: string;
}

export function AccountTab() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const form = useForm<AccountFormValues>();

  useEffect(() => {
    if (me) {
      form.reset({ displayName: me.displayName, timezone: me.timezone, locale: me.locale });
    }
  }, [me, form]);

  const errorMessage = updateMe.error instanceof ApiError ? updateMe.error.message : null;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <IdCard className="size-5 text-muted-foreground" aria-hidden="true" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => updateMe.mutate(values))}
          noValidate
        >
          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
          {updateMe.isSuccess ? <Alert variant="success">Account updated.</Alert> : null}
          <FormField label="Display name" {...form.register('displayName')} />
          <FormField label="Timezone" {...form.register('timezone')} />
          <FormField label="Locale" {...form.register('locale')} />
          <div className="flex justify-end">
            <Button type="submit" loading={updateMe.isPending}>
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
