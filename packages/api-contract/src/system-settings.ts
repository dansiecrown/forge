// Hand-authored request/response contracts for System Settings. See
// organizations.ts for the pattern this follows. A single global singleton
// row, platform-wide, SUPER_ADMIN-only — not a per-organization concept.

export interface SystemSettings {
  platformName: string;
  logoAssetId: string | null;
  primaryColor: string | null;
  defaultTheme: string;
  maintenanceMode: boolean;
  registrationOpen: boolean;
  passwordPolicy: Record<string, unknown> | null;
  sessionPolicy: Record<string, unknown> | null;
  mfaPolicy: Record<string, unknown> | null;
  featureFlags: Record<string, boolean> | null;
  version: number;
}

export interface UpdateSystemSettingsRequest {
  platformName?: string;
  logoAssetId?: string;
  primaryColor?: string;
  defaultTheme?: string;
  maintenanceMode?: boolean;
  registrationOpen?: boolean;
  passwordPolicy?: Record<string, unknown>;
  sessionPolicy?: Record<string, unknown>;
  mfaPolicy?: Record<string, unknown>;
  featureFlags?: Record<string, boolean>;
}

export interface PublicBranding {
  platformName: string;
  logoAssetId: string | null;
  primaryColor: string | null;
  defaultTheme: string;
  maintenanceMode: boolean;
}
