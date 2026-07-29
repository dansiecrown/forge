import { z } from 'zod';

const RESOURCE_TYPES = [
  'udemy_course',
  'youtube_video',
  'official_documentation',
  'github_repository',
  'pdf',
  'article',
  'book',
  'other',
] as const;

export const createLearningResourceSchema = z.object({
  resourceType: z.enum(RESOURCE_TYPES),
  title: z.string().min(1, 'Enter a resource title.').max(200),
  url: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  author: z.string().max(200).optional().or(z.literal('')),
  provider: z.string().max(200).optional().or(z.literal('')),
  estimatedDurationMinutes: z.coerce.number().int().min(1).optional().or(z.literal('')),
  isRequired: z.boolean().optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateLearningResourceFormValues = z.infer<typeof createLearningResourceSchema>;

export const updateLearningResourceSchema = createLearningResourceSchema;
export type UpdateLearningResourceFormValues = z.infer<typeof updateLearningResourceSchema>;
