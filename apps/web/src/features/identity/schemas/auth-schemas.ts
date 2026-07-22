import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type SignInFormValues = z.infer<typeof signInSchema>;

export const mfaCodeSchema = z.object({
  code: z
    .string()
    .min(6, 'Enter the 6-digit code from your authenticator app.')
    .max(8, 'Enter the code from your authenticator app.'),
});
export type MfaCodeFormValues = z.infer<typeof mfaCodeSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.');

export const resetPasswordSchema = z
  .object({
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Re-enter your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
