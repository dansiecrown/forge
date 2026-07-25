import { z } from 'zod';

export const createCohortSchema = z.object({
  fellowshipId: z.string().min(1, 'Select a fellowship.'),
  name: z.string().min(1, 'Enter a cohort name.').max(160),
  slug: z
    .string()
    .min(1, 'Enter a URL slug.')
    .max(80)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Use lowercase letters, numbers and hyphens, starting with a letter.',
    ),
  startsAt: z.string().min(1, 'Enter a start date.'),
  endsAt: z.string().min(1, 'Enter an end date.'),
  timezone: z.string().min(1, 'Enter a timezone.'),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1.'),
  description: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateCohortFormValues = z.infer<typeof createCohortSchema>;

export const updateCohortSchema = z.object({
  name: z.string().min(1, 'Enter a cohort name.').max(160),
  startsAt: z.string().min(1, 'Enter a start date.'),
  endsAt: z.string().min(1, 'Enter an end date.'),
  timezone: z.string().min(1, 'Enter a timezone.'),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1.'),
  description: z.string().max(2000).optional().or(z.literal('')),
});
export type UpdateCohortFormValues = z.infer<typeof updateCohortSchema>;

export const membershipIdSchema = z.object({
  membershipId: z.string().uuid('Enter a valid membership id.'),
});
export type MembershipIdFormValues = z.infer<typeof membershipIdSchema>;

export const studentUserIdSchema = z.object({
  studentUserId: z.string().uuid('Enter a valid user id.'),
});
export type StudentUserIdFormValues = z.infer<typeof studentUserIdSchema>;
