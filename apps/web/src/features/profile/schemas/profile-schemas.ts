import { z } from 'zod';

export const profileSchema = z.object({
  bio: z.string().max(2000).optional().or(z.literal('')),
  skills: z.string().max(500).optional().or(z.literal('')),
  interests: z.string().max(500).optional().or(z.literal('')),
  githubUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  linkedinUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  websiteUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  /** Mentor-only field in the UI ("Availability"); unused for students. */
  availability: z.string().max(500).optional().or(z.literal('')),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;
