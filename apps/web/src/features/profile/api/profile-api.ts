// Profile is a global-identity resource (one row per platform User, no
// organizationId) — see docs/adr/0007-student-experience.md. No
// `X-Organization-Id` header is needed for these calls.

import type { UserProfile, UpdateUserProfileRequest } from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function getMyProfile() {
  return apiRequest<UserProfile>('/me/profile');
}

export function updateMyProfile(body: UpdateUserProfileRequest) {
  return apiRequest<UserProfile>('/me/profile', { method: 'PATCH', body });
}
