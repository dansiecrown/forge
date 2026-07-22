import { createHash, randomBytes } from 'node:crypto';

/** High-entropy opaque token generation + lookup hashing, for refresh
 * tokens, password-reset tokens, email-verification tokens and recovery
 * codes. SHA-256 (not Argon2) is appropriate here: these are already
 * high-entropy random values, not human-chosen secrets, so a fast
 * deterministic hash for exact-match lookup is correct and standard. */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
