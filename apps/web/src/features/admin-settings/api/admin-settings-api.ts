import type { SystemSettings, UpdateSystemSettingsRequest } from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function getSystemSettings(): Promise<SystemSettings> {
  return apiRequest<SystemSettings>('/admin/settings');
}

export function updateSystemSettings(
  body: UpdateSystemSettingsRequest,
  version: number,
): Promise<SystemSettings> {
  return apiRequest<SystemSettings>('/admin/settings', { method: 'PATCH', body, ifMatch: version });
}
