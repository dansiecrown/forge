import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Enter an organization name.').max(160),
  slug: z
    .string()
    .min(1, 'Enter a URL slug.')
    .max(80)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Use lowercase letters, numbers and hyphens, starting with a letter.',
    ),
  legalName: z.string().max(160).optional().or(z.literal('')),
  defaultTimezone: z.string().optional().or(z.literal('')),
  country: z.string().max(2).optional().or(z.literal('')),
  supportEmail: z.string().email('Enter a valid email address.').optional().or(z.literal('')),
});
export type CreateOrganizationFormValues = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, 'Enter an organization name.').max(160),
  legalName: z.string().max(160).optional().or(z.literal('')),
  defaultTimezone: z.string().optional().or(z.literal('')),
  country: z.string().max(2).optional().or(z.literal('')),
  supportEmail: z.string().email('Enter a valid email address.').optional().or(z.literal('')),
});
export type UpdateOrganizationFormValues = z.infer<typeof updateOrganizationSchema>;

export const actionReasonSchema = z.object({
  reason: z.string().min(1, 'Enter a reason for this action.').max(500),
});
export type ActionReasonFormValues = z.infer<typeof actionReasonSchema>;
