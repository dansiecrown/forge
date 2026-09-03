import type { AdminDashboard } from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function getAdminDashboard(organizationId?: string): Promise<AdminDashboard> {
  return apiRequest<AdminDashboard>('/admin/dashboard', { organizationId });
}
