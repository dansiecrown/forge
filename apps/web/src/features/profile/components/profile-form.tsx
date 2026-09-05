import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ApiError } from '@/api/client';
import { AvatarPlaceholder } from '@/components/mentor/avatar-placeholder';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { TextareaField } from '@/components/textarea-field';
import { useSession } from '@/contexts/session-context';
import { useMyProfile, useUpdateMyProfile } from '../hooks/use-profile';
import { profileSchema, type ProfileFormValues } from '../schemas/profile-schemas';

/** The Profile form itself, reused by both the standalone Profile page and
 * Settings -> Profile tab (which reuses this rather than the full page to
 * avoid a nested "Profile" heading inside "Settings"). Same underlying
 * `UserProfile` shape for every role — `variant` only changes labels and
 * which fields are shown, never the data model. See
 * docs/adr/0008-mentor-experience.md Decision 4. */
export function ProfileForm({ variant = 'student' }: { variant?: 'student' | 'mentor' }) {
  const { user } = useSession();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateMyProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        bio: profile.bio ?? '',
        skills: profile.skills.join(', '),
        interests: profile.interests.join(', '),
        githubUrl: profile.githubUrl ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        websiteUrl: profile.websiteUrl ?? '',
        availability: profile.availability ?? '',
      });
    }
  }, [profile, form]);

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  async function onSubmit(values: ProfileFormValues) {
    await updateProfile.mutateAsync({
      bio: values.bio || undefined,
      skills: values.skills
        ? values.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      interests: values.interests
        ? values.interests
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      githubUrl: values.githubUrl || undefined,
      linkedinUrl: values.linkedinUrl || undefined,
      websiteUrl: values.websiteUrl || undefined,
      availability: variant === 'mentor' ? values.availability || undefined : undefined,
    });
  }

  const errorMessage = updateProfile.error instanceof ApiError ? updateProfile.error.message : null;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          {variant === 'mentor' && user ? (
            <AvatarPlaceholder name={user.displayName} size={48} />
          ) : null}
          <CardTitle as="h2">Your details</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
          {updateProfile.isSuccess ? <Alert variant="success">Profile saved.</Alert> : null}
          <TextareaField
            label="Bio"
            error={form.formState.errors.bio?.message}
            {...form.register('bio')}
          />
          <FormField
            label={
              variant === 'mentor'
                ? 'Areas of expertise (comma-separated)'
                : 'Skills (comma-separated)'
            }
            error={form.formState.errors.skills?.message}
            {...form.register('skills')}
          />
          <FormField
            label="Interests (comma-separated)"
            error={form.formState.errors.interests?.message}
            {...form.register('interests')}
          />
          <FormField
            label="GitHub URL"
            type="url"
            error={form.formState.errors.githubUrl?.message}
            {...form.register('githubUrl')}
          />
          <FormField
            label="LinkedIn URL"
            type="url"
            error={form.formState.errors.linkedinUrl?.message}
            {...form.register('linkedinUrl')}
          />
          <FormField
            label="Personal website"
            type="url"
            error={form.formState.errors.websiteUrl?.message}
            {...form.register('websiteUrl')}
          />
          {variant === 'mentor' ? (
            <FormField
              label="Availability"
              placeholder="e.g. Weekday evenings, WAT"
              error={form.formState.errors.availability?.message}
              {...form.register('availability')}
            />
          ) : null}
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={updateProfile.isPending}>
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
