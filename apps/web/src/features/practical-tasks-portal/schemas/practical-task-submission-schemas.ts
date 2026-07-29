import { z } from 'zod';

export const taskSubmissionSchema = z.object({
  repositoryUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  liveDemoUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
});
export type TaskSubmissionFormValues = z.infer<typeof taskSubmissionSchema>;
