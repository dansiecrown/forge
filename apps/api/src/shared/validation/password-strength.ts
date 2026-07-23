import { AppException } from '../errors/app.exception';

// A small, dependency-free denylist of trivially guessable passwords.
// Deliberately minimal — full breach-corpus screening is an explicit,
// documented future decision ("where legally/operationally approved"),
// not part of this check.
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyui',
  'qwerty123',
  'letmein1',
  'admin1234',
  'welcome1',
  'iloveyou',
  'changeme',
]);

/** Minimal password-strength gate backing the documented `WEAK_PASSWORD`
 * error code (docs/api-specification.md §4.1). Length bounds (8–128) are
 * already enforced by DTO validation; this adds the character-variety and
 * common-password checks that length alone doesn't cover. */
export function assertPasswordIsStrong(password: string): void {
  const normalized = password.trim().toLowerCase();

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const isSingleRepeatedChar = /^(.)\1+$/.test(password);

  if (!hasLetter || !hasDigit || isSingleRepeatedChar || COMMON_PASSWORDS.has(normalized)) {
    throw AppException.validation([
      {
        field: 'newPassword',
        code: 'WEAK_PASSWORD',
        message: 'Choose a stronger password: mix letters and numbers, and avoid common passwords.',
      },
    ]);
  }
}
