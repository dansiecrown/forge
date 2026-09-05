import type { PortfolioProject, PracticalTaskSubmission } from '@prisma/client';
import type { CohortsService } from '../../cohorts/services/cohorts.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import type { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { PracticalTaskSubmissionsRepository } from '../repositories/practical-task-submissions.repository';
import { PortfolioProjectsRepository } from '../repositories/portfolio-projects.repository';
import { PortfolioProjectsService } from './portfolio-projects.service';

const SCOPE = { organizationId: 'org-1' };

function fakeSubmission(overrides: Partial<PracticalTaskSubmission> = {}): PracticalTaskSubmission {
  return {
    id: 'submission-1',
    enrollmentId: 'enrollment-1',
    practicalTaskId: 'task-1',
    status: 'submitted',
    repositoryUrl: 'https://github.com/example/demo',
    liveDemoUrl: null,
    submittedAt: new Date(),
    submissionMetadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakePortfolioProject(overrides: Partial<PortfolioProject> = {}): PortfolioProject {
  return {
    id: 'project-1',
    organizationId: 'org-1',
    enrollmentId: 'enrollment-1',
    practicalTaskSubmissionId: 'submission-1',
    title: 'My project',
    description: null,
    technologies: [],
    skillsAcquired: [],
    repositoryUrl: null,
    liveDemoUrl: null,
    completionDate: new Date(),
    visibility: 'private',
    publicSlug: null,
    publishedAt: null,
    displayOrder: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildService(options: {
  submission?: PracticalTaskSubmission | null;
  enrollment?: EnrollmentEntity;
  canManageAnyEnrollment?: boolean;
  mentorAssignedToCohort?: boolean;
}) {
  const stored = new Map<string, PortfolioProject>();

  const portfolioProjectsRepository = {
    list: jest.fn(async () => [...stored.values()]),
    findById: jest.fn(async (_scope, id) => stored.get(id) ?? null),
    create: jest.fn(async (_scope, data) => {
      const row = fakePortfolioProject({ id: `project-${stored.size + 1}`, ...data });
      stored.set(row.id, row);
      return row;
    }),
    update: jest.fn(async (_scope, id, data) => {
      const current = stored.get(id)!;
      const updated = { ...current, ...data, version: current.version + 1 } as PortfolioProject;
      stored.set(id, updated);
      return updated;
    }),
    publish: jest.fn(async (_scope, id) => {
      const current = stored.get(id)!;
      const updated: PortfolioProject = {
        ...current,
        visibility: 'public',
        publishedAt: new Date(),
        publicSlug: current.publicSlug ?? `slug-${id}`,
        version: current.version + 1,
      };
      stored.set(id, updated);
      return updated;
    }),
    unpublish: jest.fn(async (_scope, id) => {
      const current = stored.get(id)!;
      const updated: PortfolioProject = {
        ...current,
        visibility: 'private',
        publishedAt: null,
        version: current.version + 1,
      };
      stored.set(id, updated);
      return updated;
    }),
    softDelete: jest.fn(async (_scope, id) => {
      stored.delete(id);
    }),
  } as unknown as PortfolioProjectsRepository;

  const practicalTaskSubmissionsRepository = {
    findById: jest.fn(async () =>
      options.submission === undefined ? fakeSubmission() : options.submission,
    ),
  } as unknown as PracticalTaskSubmissionsRepository;

  const enrollmentsService = {
    get: jest.fn(
      async () =>
        options.enrollment ?? ({ id: 'enrollment-1', userId: 'student-1' } as EnrollmentEntity),
    ),
  } as unknown as EnrollmentsService;

  const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;

  const cohortsService = {
    hasActiveMentorAssignment: jest.fn(async () => options.mentorAssignedToCohort ?? false),
  } as unknown as CohortsService;

  const membershipsService = {
    getActiveMembership: jest.fn(async () => ({ id: 'membership-1' }) as never),
  } as unknown as MembershipsService;

  const permissionResolver = {
    hasPermission: jest.fn(async () => options.canManageAnyEnrollment ?? false),
  } as unknown as PermissionResolverService;

  const service = new PortfolioProjectsService(
    portfolioProjectsRepository,
    practicalTaskSubmissionsRepository,
    enrollmentsService,
    cohortsService,
    membershipsService,
    permissionResolver,
    auditLog,
  );
  return { service, portfolioProjectsRepository, stored };
}

describe('PortfolioProjectsService.create', () => {
  it('rejects a submission that is still a draft', async () => {
    const { service } = buildService({ submission: fakeSubmission({ status: 'draft' }) });
    await expect(
      service.create(
        SCOPE,
        'enrollment-1',
        {
          practicalTaskSubmissionId: 'submission-1',
          title: 'My project',
          completionDate: new Date().toISOString(),
        },
        'student-1',
      ),
    ).rejects.toMatchObject({ response: { code: 'SUBMISSION_NOT_SUBMITTED' } });
  });

  it('accepts a submitted submission', async () => {
    const { service } = buildService({ submission: fakeSubmission({ status: 'submitted' }) });
    await expect(
      service.create(
        SCOPE,
        'enrollment-1',
        {
          practicalTaskSubmissionId: 'submission-1',
          title: 'My project',
          completionDate: new Date().toISOString(),
        },
        'student-1',
      ),
    ).resolves.toMatchObject({ title: 'My project' });
  });

  it('rejects when the submission does not exist', async () => {
    const { service } = buildService({ submission: null });
    await expect(
      service.create(
        SCOPE,
        'enrollment-1',
        {
          practicalTaskSubmissionId: 'submission-1',
          title: 'My project',
          completionDate: new Date().toISOString(),
        },
        'student-1',
      ),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });

  it('rejects acting on an enrollment the caller does not own', async () => {
    const { service } = buildService({
      enrollment: { id: 'enrollment-1', userId: 'someone-else' } as EnrollmentEntity,
    });
    await expect(
      service.create(
        SCOPE,
        'enrollment-1',
        {
          practicalTaskSubmissionId: 'submission-1',
          title: 'My project',
          completionDate: new Date().toISOString(),
        },
        'student-1',
      ),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });
});

describe('PortfolioProjectsService.publish / unpublish', () => {
  it('generates a publicSlug on publish and keeps it on re-publish', async () => {
    const { service, stored } = buildService({});
    const created = await service.create(
      SCOPE,
      'enrollment-1',
      {
        practicalTaskSubmissionId: 'submission-1',
        title: 'My project',
        completionDate: new Date().toISOString(),
      },
      'student-1',
    );

    const published = await service.publish(SCOPE, created.id, created.version, 'student-1');
    expect(published.publicSlug).toBeTruthy();

    const republished = await service.publish(SCOPE, created.id, published.version, 'student-1');
    expect(republished.publicSlug).toBe(published.publicSlug);
    expect(stored.get(created.id)?.publicSlug).toBe(published.publicSlug);
  });

  it('unpublish clears visibility/publishedAt but retains the slug', async () => {
    const { service } = buildService({});
    const created = await service.create(
      SCOPE,
      'enrollment-1',
      {
        practicalTaskSubmissionId: 'submission-1',
        title: 'My project',
        completionDate: new Date().toISOString(),
      },
      'student-1',
    );
    const published = await service.publish(SCOPE, created.id, created.version, 'student-1');
    const unpublished = await service.unpublish(SCOPE, created.id, published.version, 'student-1');

    expect(unpublished.visibility).toBe('private');
    expect(unpublished.publicSlug).toBe(published.publicSlug);
  });
});

describe('PortfolioProjectsService.listForMentor', () => {
  it('lets an assigned mentor see every project regardless of visibility', async () => {
    const { service, stored } = buildService({ mentorAssignedToCohort: true });
    stored.set('project-1', fakePortfolioProject({ id: 'project-1', visibility: 'private' }));
    await expect(
      service.listForMentor({ organizationId: 'org-1' }, 'enrollment-1', 'mentor-1'),
    ).resolves.toHaveLength(1);
  });

  it('rejects a mentor not assigned to this cohort', async () => {
    const { service } = buildService({ mentorAssignedToCohort: false });
    await expect(
      service.listForMentor({ organizationId: 'org-1' }, 'enrollment-1', 'mentor-1'),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });
});
