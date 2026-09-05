import type { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { ProgressionContext } from '../../learning/services/progression.service';
import { ProgressionService } from '../../learning/services/progression.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { AdminStatsRepository } from '../repositories/admin-stats.repository';
import type { CertificatesRepository } from '../repositories/certificates.repository';
import type { CertificateTemplatesRepository } from '../repositories/certificate-templates.repository';
import { CertificatesService } from './certificates.service';

const SCOPE = { organizationId: 'org-1' };

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

function fakeContext(overrides: Partial<ProgressionContext> = {}): ProgressionContext {
  const lesson = { id: 'lesson-1', completionRequired: true };
  const task = { id: 'task-1' };
  const module = {
    id: 'module-1',
    weekNumber: 1,
    lessons: [lesson],
    resources: [],
    practicalTasks: [task],
    requiresPracticalWork: true,
  };
  return {
    enrollment: { id: 'enrollment-1' } as never,
    cohort: {} as never,
    track: {} as never,
    modules: [module] as never,
    moduleLockStates: new Map([['module-1', 'completed']]) as never,
    completions: [],
    acknowledgments: [],
    submissions: [{ id: 'submission-1', practicalTaskId: 'task-1', status: 'completed' } as never],
    completedLessonIds: new Set(['lesson-1']),
    acknowledgedResourceIds: new Set(),
    submittedTaskIds: new Set(['task-1']),
    ...overrides,
  };
}

describe('CertificatesService.checkEligibility', () => {
  it('is eligible when completion, attendance, and required work all clear the thresholds', async () => {
    const progressionService: Partial<ProgressionService> = {
      buildContext: jest.fn(async () => fakeContext()),
    };
    const adminStatsRepository: Partial<AdminStatsRepository> = {
      getAttendanceRateForEnrollment: jest.fn(async () => ({
        presentCount: 9,
        totalCount: 10,
        rate: 0.9,
      })),
    };
    const service = new CertificatesService(
      {} as CertificatesRepository,
      {} as CertificateTemplatesRepository,
      {} as EnrollmentsService,
      progressionService as ProgressionService,
      adminStatsRepository as AdminStatsRepository,
      fakeAuditLog(),
    );

    const result = await service.checkEligibility(SCOPE, 'enrollment-1', 'caller-1');
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('is ineligible when attendance is below 75% and lists the reason', async () => {
    const progressionService: Partial<ProgressionService> = {
      buildContext: jest.fn(async () => fakeContext()),
    };
    const adminStatsRepository: Partial<AdminStatsRepository> = {
      getAttendanceRateForEnrollment: jest.fn(async () => ({
        presentCount: 2,
        totalCount: 10,
        rate: 0.2,
      })),
    };
    const service = new CertificatesService(
      {} as CertificatesRepository,
      {} as CertificateTemplatesRepository,
      {} as EnrollmentsService,
      progressionService as ProgressionService,
      adminStatsRepository as AdminStatsRepository,
      fakeAuditLog(),
    );

    const result = await service.checkEligibility(SCOPE, 'enrollment-1', 'caller-1');
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes('attendance'))).toBe(true);
  });

  it('is ineligible when a required practical task was never approved', async () => {
    const progressionService: Partial<ProgressionService> = {
      buildContext: jest.fn(async () =>
        fakeContext({ submissions: [], submittedTaskIds: new Set() }),
      ),
    };
    const adminStatsRepository: Partial<AdminStatsRepository> = {
      getAttendanceRateForEnrollment: jest.fn(async () => ({
        presentCount: 9,
        totalCount: 10,
        rate: 0.9,
      })),
    };
    const service = new CertificatesService(
      {} as CertificatesRepository,
      {} as CertificateTemplatesRepository,
      {} as EnrollmentsService,
      progressionService as ProgressionService,
      adminStatsRepository as AdminStatsRepository,
      fakeAuditLog(),
    );

    const result = await service.checkEligibility(SCOPE, 'enrollment-1', 'caller-1');
    expect(result.eligible).toBe(false);
    expect(result.allRequiredWorkApproved).toBe(false);
  });
});
