import type { CohortApplication, User } from '@prisma/client';
import type { UsersService } from '../../identity/services/users.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import type { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { SystemSettingsService } from '../../platform/services/system-settings.service';
import {
  CohortApplicationConflictError,
  CohortApplicationVersionConflictError,
  CohortApplicationsRepository,
} from '../repositories/cohort-applications.repository';
import { CohortApplicationsService } from './cohort-applications.service';

const SCOPE = { organizationId: 'org-1' };

function fakeApplication(overrides: Partial<CohortApplication> = {}): CohortApplication {
  return {
    id: 'application-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: 'fellowship-1',
    cohortId: 'cohort-1',
    applicantUserId: null,
    prospectEmail: 'prospect@example.com',
    prospectDisplayName: 'Prospect Person',
    requestedLearningTrackId: null,
    note: null,
    status: 'pending',
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    resultingUserId: null,
    resultingEnrollmentId: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeEnrollment(overrides: Partial<EnrollmentEntity> = {}): EnrollmentEntity {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    academyId: 'academy-1',
    fellowshipId: 'fellowship-1',
    cohortId: 'cohort-1',
    userId: 'user-1',
    status: 'invited',
    currentLearningTrackId: null,
    invitedAt: new Date(),
    joinedAt: null,
    endedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    emailCanonical: 'prospect@example.com',
    displayName: 'Prospect Person',
    givenName: null,
    familyName: null,
    status: 'invited',
    emailVerifiedAt: null,
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function fakeMembershipsService(overrides: Partial<MembershipsService> = {}): MembershipsService {
  return {
    getAcademyScope: jest.fn(async () => ({ restricted: false, academyId: null })),
    hasActiveMembership: jest.fn(async () => false),
    inviteIntoOrganization: jest.fn(async () => undefined),
    ...overrides,
  } as unknown as MembershipsService;
}

function fakeUsersService(overrides: Partial<UsersService> = {}): UsersService {
  return {
    invite: jest.fn(async () => ({ user: fakeUser(), isNewUser: true })),
    ...overrides,
  } as unknown as UsersService;
}

function fakeEnrollmentsService(overrides: Partial<EnrollmentsService> = {}): EnrollmentsService {
  return {
    findByCohortAndUser: jest.fn(async () => null),
    create: jest.fn(async () => fakeEnrollment()),
    update: jest.fn(async (_scope, _id, patch) => fakeEnrollment(patch as never)),
    ...overrides,
  } as unknown as EnrollmentsService;
}

function fakeSystemSettingsService(registrationOpen = true): SystemSettingsService {
  return {
    get: jest.fn(async () => ({ registrationOpen }) as never),
  } as unknown as SystemSettingsService;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

function buildService(overrides: {
  repository?: Partial<CohortApplicationsRepository>;
  usersService?: UsersService;
  membershipsService?: MembershipsService;
  enrollmentsService?: EnrollmentsService;
  systemSettingsService?: SystemSettingsService;
}) {
  const repository = (overrides.repository ?? {}) as CohortApplicationsRepository;
  return new CohortApplicationsService(
    repository,
    overrides.usersService ?? fakeUsersService(),
    overrides.membershipsService ?? fakeMembershipsService(),
    overrides.enrollmentsService ?? fakeEnrollmentsService(),
    overrides.systemSettingsService ?? fakeSystemSettingsService(),
    fakeAuditLog(),
  );
}

describe('CohortApplicationsService.submitAsProspect', () => {
  it('rejects when registration is closed', async () => {
    const service = buildService({ systemSettingsService: fakeSystemSettingsService(false) });

    await expect(
      service.submitAsProspect({
        cohortId: 'cohort-1',
        prospectEmail: 'p@example.com',
        prospectDisplayName: 'P',
      }),
    ).rejects.toMatchObject({ response: { code: 'REGISTRATION_CLOSED' } });
  });

  it('treats a non-public or non-enrolling cohort as not found', async () => {
    const repository: Partial<CohortApplicationsRepository> = {
      findApplyableCohort: jest.fn(async () => null),
    };
    const service = buildService({ repository });

    await expect(
      service.submitAsProspect({
        cohortId: 'cohort-1',
        prospectEmail: 'p@example.com',
        prospectDisplayName: 'P',
      }),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });

  it('lowercases and trims the prospect email before storing', async () => {
    const create = jest.fn(async () => fakeApplication());
    const repository: Partial<CohortApplicationsRepository> = {
      findApplyableCohort: jest.fn(async () => ({
        cohort: { id: 'cohort-1', organizationId: 'org-1', academyId: 'academy-1' } as never,
        fellowship: { id: 'fellowship-1' } as never,
        academy: { id: 'academy-1' } as never,
      })),
      create,
    };
    const service = buildService({ repository });

    await service.submitAsProspect({
      cohortId: 'cohort-1',
      prospectEmail: '  Prospect@Example.com  ',
      prospectDisplayName: 'Prospect Person',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ prospectEmail: 'prospect@example.com' }),
    );
  });

  it('translates a duplicate pending application into a clean conflict, not a raw 500', async () => {
    const repository: Partial<CohortApplicationsRepository> = {
      findApplyableCohort: jest.fn(async () => ({
        cohort: { id: 'cohort-1', organizationId: 'org-1', academyId: 'academy-1' } as never,
        fellowship: { id: 'fellowship-1' } as never,
        academy: { id: 'academy-1' } as never,
      })),
      create: jest.fn(async () => {
        throw new CohortApplicationConflictError();
      }),
    };
    const service = buildService({ repository });

    await expect(
      service.submitAsProspect({
        cohortId: 'cohort-1',
        prospectEmail: 'prospect@example.com',
        prospectDisplayName: 'Prospect Person',
      }),
    ).rejects.toMatchObject({ response: { code: 'APPLICATION_ALREADY_PENDING' } });
  });
});

describe('CohortApplicationsService.approve', () => {
  function repositoryStub(overrides: Partial<CohortApplicationsRepository> = {}) {
    return {
      findById: jest.fn(async () => fakeApplication()),
      update: jest.fn(async (_id, patch) => fakeApplication(patch as never)),
      ...overrides,
    } as unknown as CohortApplicationsRepository;
  }

  it('rejects approving an application that is not pending', async () => {
    const repository = repositoryStub({
      findById: jest.fn(async () => fakeApplication({ status: 'approved' })),
    });
    const service = buildService({ repository });

    await expect(service.approve(SCOPE, 'application-1', 1, 'actor-1')).rejects.toMatchObject({
      response: { code: 'INVALID_STATE_TRANSITION' },
    });
  });

  it('invites a new account for a prospect, grants membership, and creates the enrollment', async () => {
    const usersService = fakeUsersService();
    const membershipsService = fakeMembershipsService();
    const enrollmentsService = fakeEnrollmentsService();
    const repository = repositoryStub();
    const service = buildService({
      repository,
      usersService,
      membershipsService,
      enrollmentsService,
    });

    const result = await service.approve(SCOPE, 'application-1', 1, 'actor-1');

    expect(usersService.invite).toHaveBeenCalledWith(
      'prospect@example.com',
      'Prospect Person',
      'actor-1',
    );
    expect(membershipsService.inviteIntoOrganization).toHaveBeenCalledWith(
      SCOPE,
      'user-1',
      ['STUDENT'],
      'actor-1',
    );
    expect(enrollmentsService.create).toHaveBeenCalledWith(SCOPE, 'cohort-1', 'user-1', 'actor-1');
    expect(result.status).toBe('approved');
  });

  it('reuses the existing applicant identity and skips re-inviting an already-active member', async () => {
    const usersService = fakeUsersService();
    const membershipsService = fakeMembershipsService({
      hasActiveMembership: jest.fn(async () => true),
    });
    const enrollmentsService = fakeEnrollmentsService();
    const repository = repositoryStub({
      findById: jest.fn(async () =>
        fakeApplication({
          applicantUserId: 'existing-user',
          prospectEmail: null,
          prospectDisplayName: null,
        }),
      ),
    });
    const service = buildService({
      repository,
      usersService,
      membershipsService,
      enrollmentsService,
    });

    await service.approve(SCOPE, 'application-1', 1, 'actor-1');

    expect(usersService.invite).not.toHaveBeenCalled();
    expect(membershipsService.inviteIntoOrganization).not.toHaveBeenCalled();
    expect(enrollmentsService.create).toHaveBeenCalledWith(
      SCOPE,
      'cohort-1',
      'existing-user',
      'actor-1',
    );
  });

  it('is resumable after a partial failure: reuses an already-created enrollment instead of double-creating', async () => {
    const enrollmentsService = fakeEnrollmentsService({
      findByCohortAndUser: jest.fn(async () => fakeEnrollment({ id: 'existing-enrollment' })),
    });
    const repository = repositoryStub();
    const service = buildService({ repository, enrollmentsService });

    const result = await service.approve(SCOPE, 'application-1', 1, 'actor-1');

    expect(enrollmentsService.create).not.toHaveBeenCalled();
    expect(result.resultingEnrollmentId).toBe('existing-enrollment');
  });

  it('applies the requested learning track to the enrollment', async () => {
    const enrollmentsService = fakeEnrollmentsService();
    const repository = repositoryStub({
      findById: jest.fn(async () => fakeApplication({ requestedLearningTrackId: 'track-1' })),
    });
    const service = buildService({ repository, enrollmentsService });

    await service.approve(SCOPE, 'application-1', 1, 'actor-1');

    expect(enrollmentsService.update).toHaveBeenCalledWith(
      SCOPE,
      'enrollment-1',
      { currentLearningTrackId: 'track-1' },
      1,
      'actor-1',
    );
  });

  it('surfaces a version conflict cleanly', async () => {
    const repository = repositoryStub({
      update: jest.fn(async () => {
        throw new CohortApplicationVersionConflictError(2);
      }),
    });
    const service = buildService({ repository });

    await expect(service.approve(SCOPE, 'application-1', 1, 'actor-1')).rejects.toMatchObject({
      response: { code: 'VERSION_CONFLICT' },
    });
  });
});

describe('CohortApplicationsService.reject', () => {
  it('rejects a pending application with a reason', async () => {
    const repository = {
      findById: jest.fn(async () => fakeApplication()),
      update: jest.fn(async (_id, patch) => fakeApplication(patch as never)),
    } as unknown as CohortApplicationsRepository;
    const service = buildService({ repository });

    const result = await service.reject(SCOPE, 'application-1', 1, 'not a fit', 'actor-1');

    expect(result.status).toBe('rejected');
    expect(repository.update).toHaveBeenCalledWith(
      'application-1',
      expect.objectContaining({ status: 'rejected', rejectionReason: 'not a fit' }),
      1,
    );
  });

  it('rejects rejecting an application that is not pending', async () => {
    const repository = {
      findById: jest.fn(async () => fakeApplication({ status: 'withdrawn' })),
    } as unknown as CohortApplicationsRepository;
    const service = buildService({ repository });

    await expect(
      service.reject(SCOPE, 'application-1', 1, undefined, 'actor-1'),
    ).rejects.toMatchObject({ response: { code: 'INVALID_STATE_TRANSITION' } });
  });
});

describe('CohortApplicationsService.withdraw', () => {
  it('treats another user withdrawing someone elses application as not found', async () => {
    const repository = {
      findById: jest.fn(async () => fakeApplication({ applicantUserId: 'owner-1' })),
    } as unknown as CohortApplicationsRepository;
    const service = buildService({ repository });

    await expect(service.withdraw(SCOPE, 'application-1', 1, 'someone-else')).rejects.toMatchObject(
      { response: { code: 'NOT_FOUND' } },
    );
  });

  it('allows the owning applicant to withdraw their own pending application', async () => {
    const repository = {
      findById: jest.fn(async () => fakeApplication({ applicantUserId: 'owner-1' })),
      update: jest.fn(async (_id, patch) => fakeApplication(patch as never)),
    } as unknown as CohortApplicationsRepository;
    const service = buildService({ repository });

    const result = await service.withdraw(SCOPE, 'application-1', 1, 'owner-1');

    expect(result.status).toBe('withdrawn');
  });
});

describe('CohortApplicationsService.list', () => {
  it("confines an Academy Admin's queue to their own academy", async () => {
    const list = jest.fn(async () => ({ rows: [], hasMore: false }));
    const repository = { list } as unknown as CohortApplicationsRepository;
    const membershipsService = fakeMembershipsService({
      getAcademyScope: jest.fn(async () => ({ restricted: true, academyId: 'academy-1' })),
    });
    const service = buildService({ repository, membershipsService });

    await service.list(SCOPE, 'caller-1', {});

    expect(list).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ restrictToAcademyId: 'academy-1' }),
    );
  });

  it('sees nothing for an Academy Admin never anchored to an academy', async () => {
    const list = jest.fn();
    const repository = { list } as unknown as CohortApplicationsRepository;
    const membershipsService = fakeMembershipsService({
      getAcademyScope: jest.fn(async () => ({ restricted: true, academyId: null })),
    });
    const service = buildService({ repository, membershipsService });

    const result = await service.list(SCOPE, 'caller-1', {});

    expect(list).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(0);
  });
});
