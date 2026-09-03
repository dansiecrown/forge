import { Injectable } from '@nestjs/common';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { ProgressionService, summarizeProgress } from '../../learning/services/progression.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { generateOpaqueToken } from '../../../shared/crypto/opaque-token';
import { AppException } from '../../../shared/errors/app.exception';
import {
  CollectionResult,
  parseLimit,
  type PageMeta,
} from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { AdminStatsRepository } from '../repositories/admin-stats.repository';
import {
  CertificatesRepository,
  CertificateVersionConflictError,
} from '../repositories/certificates.repository';
import {
  CertificateTemplatesRepository,
  type CreateCertificateTemplateInput,
} from '../repositories/certificate-templates.repository';

const LESSON_COMPLETION_THRESHOLD = 0.9;
const ATTENDANCE_THRESHOLD = 0.75;

export interface EligibilityResult {
  eligible: boolean;
  lessonCompletionRate: number;
  attendanceRate: number;
  allRequiredWorkApproved: boolean;
  reasons: string[];
}

/** Eligibility rule: ≥90% required-lesson completion, ≥75% attendance, all
 * required PracticalTask submissions `completed`, plus admin approval (the
 * `issue()` call itself). Omits docs/database-design.md's "mentor
 * recommendation" step — not part of this milestone's feature list, no such
 * concept exists anywhere in the codebase. `eligibilitySnapshot` is frozen
 * at issue time, same "frozen read-model" precedent as
 * `Cohort.curriculumSnapshot`. PDF generation is entirely client-side
 * (browser print) — this service only ever serves template HTML + data. See
 * docs/adr/0009-administration-platform.md Decision 3. */
@Injectable()
export class CertificatesService {
  constructor(
    private readonly certificatesRepository: CertificatesRepository,
    private readonly certificateTemplatesRepository: CertificateTemplatesRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly progressionService: ProgressionService,
    private readonly adminStatsRepository: AdminStatsRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async checkEligibility(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<EligibilityResult> {
    const ctx = await this.progressionService.buildContext(scope, enrollmentId, callerId);
    const summary = summarizeProgress(ctx);
    const lessonCompletionRate = summary.progressPercent / 100;

    const { rate: attendanceRate } =
      await this.adminStatsRepository.getAttendanceRateForEnrollment(enrollmentId);

    const requiredTasks = ctx.modules
      .filter((m) => m.requiresPracticalWork)
      .flatMap((m) => m.practicalTasks);
    const completedTaskIds = new Set(
      ctx.submissions.filter((s) => s.status === 'completed').map((s) => s.practicalTaskId),
    );
    const allRequiredWorkApproved = requiredTasks.every((t) => completedTaskIds.has(t.id));

    const reasons: string[] = [];
    if (lessonCompletionRate < LESSON_COMPLETION_THRESHOLD) {
      reasons.push(`Lesson completion is ${Math.round(lessonCompletionRate * 100)}%, below 90%.`);
    }
    if (attendanceRate < ATTENDANCE_THRESHOLD) {
      reasons.push(`Huddle attendance is ${Math.round(attendanceRate * 100)}%, below 75%.`);
    }
    if (!allRequiredWorkApproved) {
      reasons.push('Not all required practical work has been approved.');
    }

    return {
      eligible: reasons.length === 0,
      lessonCompletionRate,
      attendanceRate,
      allRequiredWorkApproved,
      reasons,
    };
  }

  async issue(
    scope: TenantScope,
    enrollmentId: string,
    certificateTemplateId: string,
    actorUserId: string,
  ) {
    const enrollment = await this.enrollmentsService.get(scope, enrollmentId);
    const existing = await this.certificatesRepository.findByEnrollmentAndFellowship(
      enrollmentId,
      enrollment.fellowshipId,
    );
    if (existing && existing.status !== 'revoked') {
      throw AppException.conflict(
        'CERTIFICATE_ALREADY_ISSUED',
        'A certificate has already been issued for this enrollment and fellowship.',
      );
    }

    const template = await this.certificateTemplatesRepository.findById(
      scope,
      certificateTemplateId,
    );
    if (!template) {
      throw AppException.notFound('Certificate template not found.');
    }

    const eligibility = await this.checkEligibility(scope, enrollmentId, actorUserId);
    const verificationCode = generateOpaqueToken(16);

    const certificate = await this.certificatesRepository.issue(scope, {
      enrollmentId,
      fellowshipId: enrollment.fellowshipId,
      certificateTemplateId,
      verificationCode,
      eligibilitySnapshot: eligibility as never,
      issuedByUserId: actorUserId,
    });

    await this.auditLog.record({
      action: 'certificate.issued',
      entityType: 'certificate',
      entityId: certificate.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { enrollmentId, eligible: eligibility.eligible },
    });
    return certificate;
  }

  async revoke(
    scope: TenantScope,
    certificateId: string,
    reason: string,
    expectedVersion: number,
    actorUserId: string,
  ) {
    try {
      const revoked = await this.certificatesRepository.revoke(
        certificateId,
        reason,
        actorUserId,
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'certificate.revoked',
        entityType: 'certificate',
        entityId: certificateId,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
        metadata: { reason },
      });
      return revoked;
    } catch (error) {
      if (error instanceof CertificateVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Certificate has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  async listForOrganization(scope: TenantScope, options: { cursor?: string; limit?: string }) {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.certificatesRepository.list(scope, {
      cursor: options.cursor,
      limit,
    });
    const page: PageMeta = {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    };
    return new CollectionResult(rows, page);
  }

  listTemplates(scope: TenantScope) {
    return this.certificateTemplatesRepository.list(scope);
  }

  async createTemplate(
    scope: TenantScope,
    input: CreateCertificateTemplateInput,
    actorUserId: string,
  ) {
    const template = await this.certificateTemplatesRepository.create(scope, input);
    await this.auditLog.record({
      action: 'certificate_template.created',
      entityType: 'certificate_template',
      entityId: template.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return template;
  }

  /** Public, unauthenticated verification-by-code — no scope. Returns only
   * the display-relevant fields, never internal ids or the eligibility
   * snapshot. */
  async getPublicVerification(code: string) {
    const certificate = await this.certificatesRepository.findByVerificationCode(code);
    if (!certificate || certificate.status !== 'issued') {
      return null;
    }
    return {
      verificationCode: certificate.verificationCode,
      status: certificate.status,
      issuedAt: certificate.issuedAt,
    };
  }
}
