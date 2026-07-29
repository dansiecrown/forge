import { Injectable } from '@nestjs/common';
import type { PortfolioProject, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { generateOpaqueToken } from '../../../shared/crypto/opaque-token';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

@Injectable()
export class PortfolioProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(scope: TenantScope, enrollmentId: string): Promise<PortfolioProject[]> {
    return this.prisma.portfolioProject.findMany({
      where: { organizationId: scope.organizationId, enrollmentId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  findById(scope: TenantScope, id: string): Promise<PortfolioProject | null> {
    return this.prisma.portfolioProject.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  create(
    scope: TenantScope,
    data: {
      enrollmentId: string;
      practicalTaskSubmissionId: string;
      title: string;
      description?: string;
      technologies?: string[];
      skillsAcquired?: string[];
      repositoryUrl?: string;
      liveDemoUrl?: string;
      completionDate: Date;
    },
  ): Promise<PortfolioProject> {
    return this.prisma.portfolioProject.create({
      data: { organizationId: scope.organizationId, ...data },
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.PortfolioProjectUpdateInput,
    expectedVersion: number,
  ): Promise<PortfolioProject> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.portfolioProject.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });
      if (current.version !== expectedVersion) {
        throw new PortfolioProjectVersionConflictError(current.version);
      }
      return tx.portfolioProject.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  /** Generates `publicSlug` once, on first publish — idempotent re-publish
   * never regenerates it, so a previously-shared link stays stable. */
  async publish(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
  ): Promise<PortfolioProject> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.portfolioProject.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });
      if (current.version !== expectedVersion) {
        throw new PortfolioProjectVersionConflictError(current.version);
      }
      return tx.portfolioProject.update({
        where: { id },
        data: {
          visibility: 'public',
          publishedAt: new Date(),
          publicSlug: current.publicSlug ?? generateOpaqueToken(9),
          version: { increment: 1 },
        },
      });
    });
  }

  async unpublish(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
  ): Promise<PortfolioProject> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.portfolioProject.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });
      if (current.version !== expectedVersion) {
        throw new PortfolioProjectVersionConflictError(current.version);
      }
      // publicSlug is deliberately retained (not cleared) so a re-publish is
      // stable — see docs/adr/0007-student-experience.md.
      return tx.portfolioProject.update({
        where: { id },
        data: { visibility: 'private', publishedAt: null, version: { increment: 1 } },
      });
    });
  }

  async softDelete(scope: TenantScope, id: string, expectedVersion: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.portfolioProject.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });
      if (current.version !== expectedVersion) {
        throw new PortfolioProjectVersionConflictError(current.version);
      }
      await tx.portfolioProject.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    });
  }
}

export class PortfolioProjectVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Portfolio project has been modified since it was last read.');
  }
}
