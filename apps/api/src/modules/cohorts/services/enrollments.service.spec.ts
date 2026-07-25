import type { Enrollment } from '@prisma/client';
import type { CohortEntity } from '../entities/cohort.entity';
import type { CohortsService } from './cohorts.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import {
  EnrollmentConflictError,
  EnrollmentsRepository,
} from '../repositories/enrollments.repository';
import { EnrollmentsService } from './enrollments.service';

function fakeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: 'fellowship-1',
    cohortId: 'cohort-1',
    userId: 'user-1',
    status: 'invited',
    invitedAt: new Date(),
    joinedAt: null,
    endedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeCohort(overrides: Partial<CohortEntity> = {}): CohortEntity {
  return {
    id: 'cohort-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: 'fellowship-1',
    name: 'Cohort 2027',
    slug: 'cohort-2027',
    status: 'enrolling',
    startsAt: new Date(),
    endsAt: new Date(),
    timezone: 'Africa/Lagos',
    capacity: 2,
    description: null,
    enrollmentDeadline: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeCohortsService(cohort: CohortEntity): CohortsService {
  return { assertExists: jest.fn(async () => cohort) } as unknown as CohortsService;
}

function fakeMembershipsService(isMember: boolean): MembershipsService {
  return { hasActiveMembership: jest.fn(async () => isMember) } as unknown as MembershipsService;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

describe('EnrollmentsService', () => {
  it('rejects enrolling a user who is not an active member of the organization', async () => {
    const repository: Partial<EnrollmentsRepository> = {};
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(false),
      fakeAuditLog(),
    );

    await expect(
      service.create({ organizationId: 'org-1' }, 'cohort-1', 'user-1'),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects enrolling once the cohort has reached capacity', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      countActiveForCohort: jest.fn(async () => 2),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort({ capacity: 2 })),
      fakeMembershipsService(true),
      fakeAuditLog(),
    );

    await expect(
      service.create({ organizationId: 'org-1' }, 'cohort-1', 'user-1'),
    ).rejects.toMatchObject({ response: { code: 'CAPACITY_REACHED' } });
  });

  it('translates the database partial-unique-index violation into ACTIVE_ENROLLMENT_EXISTS', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      countActiveForCohort: jest.fn(async () => 0),
      create: jest.fn(async () => {
        throw new EnrollmentConflictError();
      }),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeAuditLog(),
    );

    await expect(
      service.create({ organizationId: 'org-1' }, 'cohort-1', 'user-1'),
    ).rejects.toMatchObject({ response: { code: 'ACTIVE_ENROLLMENT_EXISTS' } });
  });

  it('only allows the documented enrollment transitions (never completed -> active)', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async (scope) =>
        scope.organizationId === 'org-1' ? fakeEnrollment({ status: 'completed' }) : null,
      ),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeAuditLog(),
    );

    await expect(
      service.updateStatus({ organizationId: 'org-1' }, 'enrollment-1', { status: 'active' }, 1),
    ).rejects.toMatchObject({ response: { code: 'INVALID_STATE_TRANSITION' } });
  });

  it('treats an enrollment from another organization as not found', async () => {
    const repository: Partial<EnrollmentsRepository> = {
      findById: jest.fn(async (scope) =>
        scope.organizationId === 'org-1' ? fakeEnrollment() : null,
      ),
    };
    const service = new EnrollmentsService(
      repository as EnrollmentsRepository,
      fakeCohortsService(fakeCohort()),
      fakeMembershipsService(true),
      fakeAuditLog(),
    );

    await expect(service.get({ organizationId: 'org-2' }, 'enrollment-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });
});
