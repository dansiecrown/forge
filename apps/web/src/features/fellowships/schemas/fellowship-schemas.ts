import { z } from 'zod';

export const createFellowshipSchema = z.object({
  academyId: z.string().min(1, 'Select an academy.'),
  title: z.string().min(1, 'Enter a title.').max(200),
  slug: z
    .string()
    .min(1, 'Enter a URL slug.')
    .max(80)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Use lowercase letters, numbers and hyphens, starting with a letter.',
    ),
  durationWeeks: z.coerce.number().int().min(1).max(52),
  summary: z.string().max(500).optional().or(z.literal('')),
  description: z.string().max(5000).optional().or(z.literal('')),
  defaultCapacity: z.coerce.number().int().min(1).optional().or(z.literal('')),
  isPublic: z.boolean().optional(),
});
export type CreateFellowshipFormValues = z.infer<typeof createFellowshipSchema>;

export const updateFellowshipSchema = z.object({
  title: z.string().min(1, 'Enter a title.').max(200),
  durationWeeks: z.coerce.number().int().min(1).max(52),
  summary: z.string().max(500).optional().or(z.literal('')),
  description: z.string().max(5000).optional().or(z.literal('')),
  defaultCapacity: z.coerce.number().int().min(1).optional().or(z.literal('')),
  isPublic: z.boolean().optional(),
});
export type UpdateFellowshipFormValues = z.infer<typeof updateFellowshipSchema>;
