import { Injectable } from '@nestjs/common';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { assertOwnEnrollment } from '../support/enrollment-ownership';
import { assertMentorAssignedToCohort } from '../support/mentor-cohort-scope';
import {
  toPortfolioProjectEntity,
  type PortfolioProjectEntity,
} from '../entities/portfolio-project.entity';
import type {
  CreatePortfolioProjectDto,
  UpdatePortfolioProjectDto,
} from '../dtos/portfolio-project.dto';
import { PracticalTaskSubmissionsRepository } from '../repositories/practical-task-submissions.repository';
import {
  PortfolioProjectsRepository,
  PortfolioProjectVersionConflictError,
} from '../repositories/portfolio-projects.repository';

@Injectable()
export class PortfolioProjectsService {
  constructor(
    private readonly portfolioProjectsRepository: PortfolioProjectsRepository,
    private readonly practicalTaskSubmissionsRepository: PracticalTaskSubmissionsRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly cohortsService: CohortsService,
    private readonly membershipsService: MembershipsService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<PortfolioProjectEntity[]> {
    await assertOwnEnrollment(this.enrollmentsService, scope, enrollmentId, callerId);
    const rows = await this.portfolioProjectsRepository.list(scope, enrollmentId);
    return rows.map(toPortfolioProjectEntity);
  }

  /** Mentor-scoped read — an assigned mentor sees every project regardless
   * of `visibility` (private + public), since portfolio projects are
   * sourced only from submissions the mentor already has full review access
   * to; no new privacy exposure. Reuses the existing `list()` repository
   * call unchanged — nothing is ever filtered on visibility at the repo
   * layer — see docs/adr/0008-mentor-experience.md Decision 5. */
  async listForMentor(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<PortfolioProjectEntity[]> {
    const enrollment = await this.enrollmentsService.get(scope, enrollmentId);
    await assertMentorAssignedToCohort(
      this.cohortsService,
      this.membershipsService,
      this.permissionResolver,
      scope,
      callerId,
      enrollment.cohortId,
    );
    const rows = await this.portfolioProjectsRepository.list(scope, enrollmentId);
    return rows.map(toPortfolioProjectEntity);
  }

  async get(scope: TenantScope, id: string): Promise<PortfolioProjectEntity> {
    const row = await this.portfolioProjectsRepository.findById(scope, id);
    if (!row) {
      throw AppException.notFound('Portfolio project not found.');
    }
    return toPortfolioProjectEntity(row);
  }

  private async assertOwnProject(
    scope: TenantScope,
    id: string,
    callerId: string,
  ): Promise<PortfolioProjectEntity> {
    const project = await this.get(scope, id);
    await assertOwnEnrollment(this.enrollmentsService, scope, project.enrollmentId, callerId);
    return project;
  }

  /** Sourced from a submission that has been submitted at least once
   * (`status !== 'draft'`) — the brief says "completed Practical Tasks," but
   * `completed` is unreachable this milestone (no mentor review exists), so
   * "submitted" is the only practically achievable reading — see
   * docs/adr/0007-student-experience.md. */
  async create(
    scope: TenantScope,
    enrollmentId: string,
    input: CreatePortfolioProjectDto,
    callerId: string,
  ): Promise<PortfolioProjectEntity> {
    await assertOwnEnrollment(this.enrollmentsService, scope, enrollmentId, callerId);

    const submission = await this.practicalTaskSubmissionsRepository.findById(
      input.practicalTaskSubmissionId,
    );
    if (!submission || submission.enrollmentId !== enrollmentId) {
      throw AppException.notFound('Practical task submission not found.');
    }
    if (submission.status === 'draft') {
      throw AppException.conflict(
        'SUBMISSION_NOT_SUBMITTED',
        'Only a submitted practical task can be featured in your portfolio.',
      );
    }

    const created = await this.portfolioProjectsRepository.create(scope, {
      enrollmentId,
      practicalTaskSubmissionId: submission.id,
      title: input.title,
      description: input.description,
      technologies: input.technologies,
      skillsAcquired: input.skillsAcquired,
      repositoryUrl: input.repositoryUrl,
      liveDemoUrl: input.liveDemoUrl,
      completionDate: new Date(input.completionDate),
    });

    await this.auditLog.record({
      action: 'portfolio_project.created',
      entityType: 'portfolio_project',
      entityId: created.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
    });
    return toPortfolioProjectEntity(created);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdatePortfolioProjectDto,
    expectedVersion: number,
    callerId: string,
  ): Promise<PortfolioProjectEntity> {
    await this.assertOwnProject(scope, id, callerId);
    try {
      const updated = await this.portfolioProjectsRepository.update(
        scope,
        id,
        {
          ...input,
          completionDate: input.completionDate ? new Date(input.completionDate) : undefined,
        },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'portfolio_project.updated',
        entityType: 'portfolio_project',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: callerId,
      });
      return toPortfolioProjectEntity(updated);
    } catch (error) {
      throw this.mapVersionConflict(error);
    }
  }

  async publish(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    callerId: string,
  ): Promise<PortfolioProjectEntity> {
    await this.assertOwnProject(scope, id, callerId);
    try {
      const updated = await this.portfolioProjectsRepository.publish(scope, id, expectedVersion);
      await this.auditLog.record({
        action: 'portfolio_project.published',
        entityType: 'portfolio_project',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: callerId,
      });
      return toPortfolioProjectEntity(updated);
    } catch (error) {
      throw this.mapVersionConflict(error);
    }
  }

  async unpublish(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    callerId: string,
  ): Promise<PortfolioProjectEntity> {
    await this.assertOwnProject(scope, id, callerId);
    try {
      const updated = await this.portfolioProjectsRepository.unpublish(scope, id, expectedVersion);
      await this.auditLog.record({
        action: 'portfolio_project.unpublished',
        entityType: 'portfolio_project',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: callerId,
      });
      return toPortfolioProjectEntity(updated);
    } catch (error) {
      throw this.mapVersionConflict(error);
    }
  }

  async delete(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    callerId: string,
  ): Promise<void> {
    await this.assertOwnProject(scope, id, callerId);
    try {
      await this.portfolioProjectsRepository.softDelete(scope, id, expectedVersion);
      await this.auditLog.record({
        action: 'portfolio_project.deleted',
        entityType: 'portfolio_project',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: callerId,
      });
    } catch (error) {
      throw this.mapVersionConflict(error);
    }
  }

  private mapVersionConflict(error: unknown): unknown {
    if (error instanceof PortfolioProjectVersionConflictError) {
      return AppException.conflict(
        'VERSION_CONFLICT',
        `Portfolio project has moved to version ${error.currentVersion}.`,
      );
    }
    return error;
  }
}
