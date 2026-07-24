import type { Response } from 'express';

export const REFRESH_COOKIE_NAME = 'forge_refresh_token';

/** Rotated refresh tokens are Secure, HttpOnly, SameSite cookies per
 * docs/system-architecture.md §6 — never readable by client JavaScript.
 * SameSite=Lax is the primary CSRF mitigation for this milestone; a
 * dedicated CSRF token is deferred (see Milestone 2 report). */
export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    signed: true,
    expires: expiresAt,
    path: '/api/v1/auth',
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
}
