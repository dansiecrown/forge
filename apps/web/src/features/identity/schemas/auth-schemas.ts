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

// Mirrors the server's own strength gate
// (apps/api/src/shared/validation/password-strength.ts) — length here, plus
// the letter+digit mix, so a weak password is caught before the round trip
// instead of only surfacing as a generic 422 the caller has to decode. The
// common-password denylist stays server-only (a small, deliberately
// non-exhaustive list not worth duplicating client-side); that one check
// still only ever surfaces after submit, via `describeApiError`.
export const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    message: 'Include both letters and numbers.',
  });

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
