import { z } from 'zod';

export const createAcademySchema = z.object({
  name: z.string().min(1, 'Enter an academy name.').max(160),
  slug: z
    .string()
    .min(1, 'Enter a URL slug.')
    .max(80)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Use lowercase letters, numbers and hyphens, starting with a letter.',
    ),
  timezone: z.string().optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
  contactEmail: z.string().email('Enter a valid email address.').optional().or(z.literal('')),
  isPublic: z.boolean().optional(),
});
export type CreateAcademyFormValues = z.infer<typeof createAcademySchema>;

export const updateAcademySchema = z.object({
  name: z.string().min(1, 'Enter an academy name.').max(160),
  timezone: z.string().optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
  contactEmail: z.string().email('Enter a valid email address.').optional().or(z.literal('')),
  isPublic: z.boolean().optional(),
});
export type UpdateAcademyFormValues = z.infer<typeof updateAcademySchema>;
