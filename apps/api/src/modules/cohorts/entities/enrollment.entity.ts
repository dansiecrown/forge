import type { Enrollment } from '@prisma/client';

export interface EnrollmentEntity {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  cohortId: string;
  userId: string;
  status: string;
  invitedAt: Date;
  joinedAt: Date | null;
  endedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toEnrollmentEntity(row: Enrollment): EnrollmentEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    academyId: row.academyId,
    fellowshipId: row.fellowshipId,
    cohortId: row.cohortId,
    userId: row.userId,
    status: row.status,
    invitedAt: row.invitedAt,
    joinedAt: row.joinedAt,
    endedAt: row.endedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
