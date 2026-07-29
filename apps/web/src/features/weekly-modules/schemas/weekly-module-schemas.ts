import { z } from 'zod';

export const createWeeklyModuleSchema = z.object({
  weekNumber: z.coerce.number().int().min(1).max(104),
  title: z.string().min(1, 'Enter a week title.').max(200),
  objectives: z.string().max(2000).optional().or(z.literal('')),
  summary: z.string().max(2000).optional().or(z.literal('')),
  estimatedStudyHours: z.coerce.number().int().min(1).optional().or(z.literal('')),
  requiresMentorHuddle: z.boolean().optional(),
  requiresPracticalWork: z.boolean().optional(),
  huddleMeetingLink: z.string().max(500).optional().or(z.literal('')),
  mentorHuddleNotes: z.string().max(2000).optional().or(z.literal('')),
  huddleAttendanceRequired: z.boolean().optional(),
});
export type CreateWeeklyModuleFormValues = z.infer<typeof createWeeklyModuleSchema>;

export const updateWeeklyModuleSchema = z.object({
  weekNumber: z.coerce.number().int().min(1).max(104),
  title: z.string().min(1, 'Enter a week title.').max(200),
  objectives: z.string().max(2000).optional().or(z.literal('')),
  summary: z.string().max(2000).optional().or(z.literal('')),
  estimatedStudyHours: z.coerce.number().int().min(1).optional().or(z.literal('')),
  requiresMentorHuddle: z.boolean().optional(),
  requiresPracticalWork: z.boolean().optional(),
  huddleMeetingLink: z.string().max(500).optional().or(z.literal('')),
  mentorHuddleNotes: z.string().max(2000).optional().or(z.literal('')),
  huddleAttendanceRequired: z.boolean().optional(),
});
export type UpdateWeeklyModuleFormValues = z.infer<typeof updateWeeklyModuleSchema>;
