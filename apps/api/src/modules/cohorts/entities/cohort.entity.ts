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
  /** Frozen curriculum read-model — see docs/adr/0006-curriculum-learning-engine.md
   * Decision 1. Null until the fellowship's curriculum has been snapshotted
   * (always populated at creation once Learning Tracks exist). */
  curriculumSnapshot: unknown;
  curriculumSnapshotAt: Date | null;
  /** Null (default) means a learner may still switch their own enrolled
   * track after their first pick; set once an admin manually closes this
   * Cohort's switch window — see
   * docs/adr/0017-track-switch-grace-period.md. */
  trackSwitchClosedAt: Date | null;
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
    curriculumSnapshot: row.curriculumSnapshot,
    curriculumSnapshotAt: row.curriculumSnapshotAt,
    trackSwitchClosedAt: row.trackSwitchClosedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
