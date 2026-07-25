import type { Academy } from '@prisma/client';

export interface AcademyEntity {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  timezone: string;
  branding: unknown;
  contactEmail: string | null;
  isPublic: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toAcademyEntity(row: Academy): AcademyEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    slug: row.slug,
    status: row.status,
    description: row.description,
    timezone: row.timezone,
    branding: row.branding,
    contactEmail: row.contactEmail,
    isPublic: row.isPublic,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
