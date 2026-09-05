// Hand-authored request/response contracts for the Organizations endpoints
// (docs/api-specification.md §4.3). See identity.ts for the pattern this
// follows — no codegen pipeline exists yet.

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'provisioning' | 'active' | 'suspended' | 'archived';
  legalName: string | null;
  defaultTimezone: string;
  country: string | null;
  dataRegion: string;
  supportEmail: string | null;
  customDomain: string | null;
  logoAssetId: string | null;
  branding: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  settingsVersion: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  legalName?: string;
  defaultTimezone?: string;
  country?: string;
  supportEmail?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  legalName?: string;
  defaultTimezone?: string;
  country?: string;
  supportEmail?: string;
  customDomain?: string;
  logoAssetId?: string;
  branding?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface ListOrganizationsParams {
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface OrganizationAdmin {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  status: string;
}
