import type { WeeklyModule } from '@prisma/client';
import type { CourseEntity } from '../entities/course.entity';
import type { CoursesService } from './courses.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import { WeeklyModulesRepository } from '../repositories/weekly-modules.repository';
import { WeeklyModulesService } from './weekly-modules.service';

function fakeModule(overrides: Partial<WeeklyModule> = {}): WeeklyModule {
  return {
    id: 'module-1',
    organizationId: 'org-1',
    courseId: 'course-1',
    weekNumber: 1,
    title: 'Week 1',
    objectives: [],
    summary: null,
    estimatedStudyHours: null,
    requiresMentorHuddle: false,
    requiresPracticalWork: false,
    unlockRules: null,
    huddleScheduleMetadata: null,
    huddleMeetingLink: null,
    mentorHuddleNotes: null,
    huddleAttendanceRequired: false,
    status: 'draft',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function fakeCoursesService(): CoursesService {
  return {
    assertBelongsToScope: jest.fn(async () => ({ id: 'course-1' }) as CourseEntity),
  } as unknown as CoursesService;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

describe('WeeklyModulesService', () => {
  it('treats a module from another organization as not found', async () => {
    const repository: Partial<WeeklyModulesRepository> = {
      findById: jest.fn(async (scope) => (scope.organizationId === 'org-1' ? fakeModule() : null)),
    };
    const service = new WeeklyModulesService(
      repository as WeeklyModulesRepository,
      fakeCoursesService(),
      fakeAuditLog(),
    );

    await expect(service.get({ organizationId: 'org-2' }, 'module-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('rejects a duplicate week number within the same course', async () => {
    const repository: Partial<WeeklyModulesRepository> = {
      findByWeekNumber: jest.fn(async () => fakeModule()),
    };
    const service = new WeeklyModulesService(
      repository as WeeklyModulesRepository,
      fakeCoursesService(),
      fakeAuditLog(),
    );

    await expect(
      service.create(
        { organizationId: 'org-1' },
        'course-1',
        { weekNumber: 1, title: 'Week 1 (again)' },
        'user-1',
      ),
    ).rejects.toMatchObject({ response: { code: 'WEEK_NUMBER_TAKEN' } });
  });

  it('allows renumbering a week to one not already in use', async () => {
    const repository: Partial<WeeklyModulesRepository> = {
      findById: jest.fn(async () => fakeModule({ weekNumber: 1 })),
      findByWeekNumber: jest.fn(async () => null),
      update: jest.fn(async () => fakeModule({ weekNumber: 2, version: 2 })),
    };
    const service = new WeeklyModulesService(
      repository as WeeklyModulesRepository,
      fakeCoursesService(),
      fakeAuditLog(),
    );

    await expect(
      service.update({ organizationId: 'org-1' }, 'module-1', { weekNumber: 2 }, 1),
    ).resolves.toMatchObject({ weekNumber: 2 });
  });

  it('only allows draft -> published -> archived, never published -> draft', async () => {
    const repository: Partial<WeeklyModulesRepository> = {
      findById: jest.fn(async () => fakeModule({ status: 'published' })),
      updateStatus: jest.fn(async () => fakeModule({ status: 'archived', version: 2 })),
    };
    const service = new WeeklyModulesService(
      repository as WeeklyModulesRepository,
      fakeCoursesService(),
      fakeAuditLog(),
    );

    await expect(service.publish({ organizationId: 'org-1' }, 'module-1', 1)).rejects.toMatchObject(
      { response: { code: 'INVALID_STATE_TRANSITION' } },
    );
    await expect(
      service.archive({ organizationId: 'org-1' }, 'module-1', 1),
    ).resolves.toMatchObject({ status: 'archived' });
  });
});
