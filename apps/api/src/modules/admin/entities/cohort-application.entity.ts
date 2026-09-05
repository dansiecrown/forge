import type { CohortApplication } from '@prisma/client';

export interface CohortApplicationEntity {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  cohortId: string;
  applicantUserId: string | null;
  prospectEmail: string | null;
  prospectDisplayName: string | null;
  requestedLearningTrackId: string | null;
  note: string | null;
  status: string;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  resultingUserId: string | null;
  resultingEnrollmentId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCohortApplicationEntity(row: CohortApplication): CohortApplicationEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    academyId: row.academyId,
    fellowshipId: row.fellowshipId,
    cohortId: row.cohortId,
    applicantUserId: row.applicantUserId,
    prospectEmail: row.prospectEmail,
    prospectDisplayName: row.prospectDisplayName,
    requestedLearningTrackId: row.requestedLearningTrackId,
    note: row.note,
    status: row.status,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    rejectionReason: row.rejectionReason,
    resultingUserId: row.resultingUserId,
    resultingEnrollmentId: row.resultingEnrollmentId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
