import { z } from 'zod';

const LESSON_TYPES = [
  'video',
  'article',
  'documentation',
  'reading',
  'external_resource',
  'live_session_reference',
  'embedded_content',
] as const;

export const createLessonSchema = z.object({
  title: z.string().min(1, 'Enter a lesson title.').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  lessonType: z.enum(LESSON_TYPES),
  estimatedDurationMinutes: z.coerce.number().int().min(1).optional().or(z.literal('')),
  resourceUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  completionRequired: z.boolean().optional(),
});
export type CreateLessonFormValues = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = createLessonSchema;
export type UpdateLessonFormValues = z.infer<typeof updateLessonSchema>;
