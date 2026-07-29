import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Enter a course title.').max(200),
  slug: z
    .string()
    .min(1, 'Enter a URL slug.')
    .max(80)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Use lowercase letters, numbers and hyphens, starting with a letter.',
    ),
  overview: z.string().max(2000).optional().or(z.literal('')),
  objectives: z.string().max(2000).optional().or(z.literal('')),
  completionCriteria: z.string().max(2000).optional().or(z.literal('')),
  estimatedHours: z.coerce.number().int().min(1).max(1000).optional().or(z.literal('')),
});
export type CreateCourseFormValues = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object({
  title: z.string().min(1, 'Enter a course title.').max(200),
  overview: z.string().max(2000).optional().or(z.literal('')),
  objectives: z.string().max(2000).optional().or(z.literal('')),
  completionCriteria: z.string().max(2000).optional().or(z.literal('')),
  estimatedHours: z.coerce.number().int().min(1).max(1000).optional().or(z.literal('')),
});
export type UpdateCourseFormValues = z.infer<typeof updateCourseSchema>;
