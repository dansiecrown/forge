import type { Organization } from '@prisma/client';

/** Domain-shaped Organization — never the raw Prisma row. Per DEBT-005, this
 * is the first module to introduce an entities/ layer. */
export interface OrganizationEntity {
  id: string;
  name: string;
  slug: string;
  status: string;
  legalName: string | null;
  defaultTimezone: string;
  country: string | null;
  dataRegion: string;
  supportEmail: string | null;
  customDomain: string | null;
  logoAssetId: string | null;
  branding: unknown;
  settings: unknown;
  settingsVersion: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toOrganizationEntity(row: Organization): OrganizationEntity {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    legalName: row.legalName,
    defaultTimezone: row.defaultTimezone,
    country: row.country,
    dataRegion: row.dataRegion,
    supportEmail: row.supportEmail,
    customDomain: row.customDomain,
    logoAssetId: row.logoAssetId,
    branding: row.branding,
    settings: row.settings,
    settingsVersion: row.settingsVersion,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
