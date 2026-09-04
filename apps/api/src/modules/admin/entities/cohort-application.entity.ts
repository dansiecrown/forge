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
  /** Resolved from the `applicant` relation — set only for an
   * already-authenticated applicant (`applicantUserId` is set). A prospect
   * application already carries its own `prospectDisplayName`/`prospectEmail`
   * directly on the row, so this is never needed there. */
  applicantDisplayName: string | null;
  applicantEmail: string | null;
  fellowshipTitle: string | null;
  cohortName: string | null;
  requestedLearningTrackName: string | null;
  reviewedByDisplayName: string | null;
}

/** The relation shapes `CohortApplicationsRepository.list()`/`findById()`
 * load via `APPLICATION_INCLUDE`. Optional here because `create()`/`update()`
 * return the bare row with no relations loaded — this mapper degrades
 * gracefully to `null` for every resolved field in that case, matching
 * `prospectEmail`/`prospectDisplayName`'s own existing nullable convention. */
export interface CohortApplicationRelations {
  applicant?: { displayName: string; emailCanonical: string } | null;
  fellowship?: { title: string } | null;
  cohort?: { name: string } | null;
  requestedLearningTrack?: { name: string } | null;
  reviewedBy?: { displayName: string } | null;
}

export function toCohortApplicationEntity(
  row: CohortApplication & CohortApplicationRelations,
): CohortApplicationEntity {
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
    applicantDisplayName: row.applicant?.displayName ?? null,
    applicantEmail: row.applicant?.emailCanonical ?? null,
    fellowshipTitle: row.fellowship?.title ?? null,
    cohortName: row.cohort?.name ?? null,
    requestedLearningTrackName: row.requestedLearningTrack?.name ?? null,
    reviewedByDisplayName: row.reviewedBy?.displayName ?? null,
  };
}
