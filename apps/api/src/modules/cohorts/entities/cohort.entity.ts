import type { Cohort } from '@prisma/client';

export interface CohortEntity {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  capacity: number;
  description: string | null;
  enrollmentDeadline: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCohortEntity(row: Cohort): CohortEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    academyId: row.academyId,
    fellowshipId: row.fellowshipId,
    name: row.name,
    slug: row.slug,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    capacity: row.capacity,
    description: row.description,
    enrollmentDeadline: row.enrollmentDeadline,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
