import { z } from 'zod';

export const createPortfolioProjectSchema = z.object({
  practicalTaskSubmissionId: z.string().min(1, 'Choose a submitted task.'),
  title: z.string().min(1, 'Enter a title.').max(200),
  description: z.string().max(4000).optional().or(z.literal('')),
  technologies: z.string().max(500).optional().or(z.literal('')),
  skillsAcquired: z.string().max(500).optional().or(z.literal('')),
  repositoryUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  liveDemoUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  completionDate: z.string().min(1, 'Choose a completion date.'),
});
export type CreatePortfolioProjectFormValues = z.infer<typeof createPortfolioProjectSchema>;

export const updatePortfolioProjectSchema = z.object({
  title: z.string().min(1, 'Enter a title.').max(200),
  description: z.string().max(4000).optional().or(z.literal('')),
  technologies: z.string().max(500).optional().or(z.literal('')),
  skillsAcquired: z.string().max(500).optional().or(z.literal('')),
  repositoryUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  liveDemoUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  completionDate: z.string().min(1, 'Choose a completion date.'),
});
export type UpdatePortfolioProjectFormValues = z.infer<typeof updatePortfolioProjectSchema>;
