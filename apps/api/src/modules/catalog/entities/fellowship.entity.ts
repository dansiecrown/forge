import type { Fellowship } from '@prisma/client';

export interface FellowshipEntity {
  id: string;
  organizationId: string;
  academyId: string;
  title: string;
  slug: string;
  status: string;
  durationWeeks: number;
  description: string | null;
  summary: string | null;
  defaultCapacity: number | null;
  isPublic: boolean;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  eligibilityMetadata: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toFellowshipEntity(row: Fellowship): FellowshipEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    academyId: row.academyId,
    title: row.title,
    slug: row.slug,
    status: row.status,
    durationWeeks: row.durationWeeks,
    description: row.description,
    summary: row.summary,
    defaultCapacity: row.defaultCapacity,
    isPublic: row.isPublic,
    registrationOpensAt: row.registrationOpensAt,
    registrationClosesAt: row.registrationClosesAt,
    eligibilityMetadata: row.eligibilityMetadata,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
