import { z } from 'zod';

export const createPracticalTaskSchema = z.object({
  title: z.string().min(1, 'Enter a task title.').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  instructions: z.string().max(5000).optional().or(z.literal('')),
  deliverables: z.string().max(2000).optional().or(z.literal('')),
  dueOffsetDays: z.coerce.number().int().min(0).optional().or(z.literal('')),
  maxScore: z.coerce.number().int().min(0).optional().or(z.literal('')),
});
export type CreatePracticalTaskFormValues = z.infer<typeof createPracticalTaskSchema>;

export const updatePracticalTaskSchema = createPracticalTaskSchema;
export type UpdatePracticalTaskFormValues = z.infer<typeof updatePracticalTaskSchema>;
