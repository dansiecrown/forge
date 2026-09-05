import { z } from 'zod';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

// `tags`/`learningOutcomes` are edited as comma-separated text and split on
// submit — simplest UX without a dedicated tag-input component.
export const createLearningTrackSchema = z.object({
  name: z.string().min(1, 'Enter a track name.').max(160),
  slug: z
    .string()
    .min(1, 'Enter a URL slug.')
    .max(80)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Use lowercase letters, numbers and hyphens, starting with a letter.',
    ),
  description: z.string().max(2000).optional().or(z.literal('')),
  difficulty: z.enum(DIFFICULTIES).optional(),
  estimatedWeeks: z.coerce.number().int().min(1).max(104).optional().or(z.literal('')),
  learningOutcomes: z.string().max(2000).optional().or(z.literal('')),
  tags: z.string().max(500).optional().or(z.literal('')),
});
export type CreateLearningTrackFormValues = z.infer<typeof createLearningTrackSchema>;

export const updateLearningTrackSchema = z.object({
  name: z.string().min(1, 'Enter a track name.').max(160),
  description: z.string().max(2000).optional().or(z.literal('')),
  difficulty: z.enum(DIFFICULTIES).optional(),
  estimatedWeeks: z.coerce.number().int().min(1).max(104).optional().or(z.literal('')),
  learningOutcomes: z.string().max(2000).optional().or(z.literal('')),
  tags: z.string().max(500).optional().or(z.literal('')),
});
export type UpdateLearningTrackFormValues = z.infer<typeof updateLearningTrackSchema>;
