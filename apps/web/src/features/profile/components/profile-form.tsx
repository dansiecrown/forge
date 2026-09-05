import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ApiError } from '@/api/client';
import { AvatarPlaceholder } from '@/components/mentor/avatar-placeholder';
import { DefinitionList } from '@/components/admin/definition-list';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { TextareaField } from '@/components/textarea-field';
import { useToast } from '@/components/ui/toast';
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
  const [editOpen, setEditOpen] = useState(false);
  const toast = useToast();

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
    try {
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
      toast.success('Profile updated.');
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update profile.');
    }
  }

  const errorMessage = updateProfile.error instanceof ApiError ? updateProfile.error.message : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          {variant === 'mentor' && user ? (
            <AvatarPlaceholder name={user.displayName} size={48} />
          ) : null}
          <CardTitle as="h2">Your details</CardTitle>
        </div>
        <Button
          variant="secondary"
          onClick={() => setEditOpen(true)}
          aria-label="Edit your details"
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <DefinitionList
          items={[
            {
              label: variant === 'mentor' ? 'Areas of expertise' : 'Skills',
              value: profile?.skills.length ? profile.skills.join(', ') : null,
            },
            {
              label: 'Interests',
              value: profile?.interests.length ? profile.interests.join(', ') : null,
            },
            { label: 'GitHub', value: profile?.githubUrl },
            { label: 'LinkedIn', value: profile?.linkedinUrl },
            { label: 'Website', value: profile?.websiteUrl },
            ...(variant === 'mentor'
              ? [{ label: 'Availability', value: profile?.availability }]
              : []),
          ]}
        />
        <div>
          <p className="text-sm text-muted-foreground">Bio</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium text-foreground">
            {profile?.bio || '—'}
          </p>
        </div>
      </CardContent>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit your details">
        <form className="flex flex-wrap gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {errorMessage ? (
            <Alert variant="danger" className="w-full">
              {errorMessage}
            </Alert>
          ) : null}
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
          <TextareaField
            label="Bio"
            error={form.formState.errors.bio?.message}
            {...form.register('bio')}
          />
          <div className="flex w-full justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateProfile.isPending}>
              Save profile
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
