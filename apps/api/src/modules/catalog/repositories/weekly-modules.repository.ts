import { Injectable } from '@nestjs/common';
import type { CurriculumStatus, Prisma, WeeklyModule } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface ListWeeklyModulesOptions {
  courseId: string;
  status?: CurriculumStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class WeeklyModulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListWeeklyModulesOptions,
  ): Promise<{ rows: WeeklyModule[]; hasMore: boolean }> {
    const where: Prisma.WeeklyModuleWhereInput = {
      organizationId: scope.organizationId,
      courseId: options.courseId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.weeklyModule.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { weekNumber: 'asc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(scope: TenantScope, id: string): Promise<WeeklyModule | null> {
    return this.prisma.weeklyModule.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  findByIdIncludingArchived(scope: TenantScope, id: string): Promise<WeeklyModule | null> {
    return this.prisma.weeklyModule.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
  }

  findByWeekNumber(
    scope: TenantScope,
    courseId: string,
    weekNumber: number,
  ): Promise<WeeklyModule | null> {
    return this.prisma.weeklyModule.findFirst({
      where: { organizationId: scope.organizationId, courseId, weekNumber, deletedAt: null },
    });
  }

  create(
    scope: TenantScope,
    data: {
      courseId: string;
      weekNumber: number;
      title: string;
      objectives?: string[];
      summary?: string;
      estimatedStudyHours?: number;
      requiresMentorHuddle?: boolean;
      requiresPracticalWork?: boolean;
      unlockRules?: Record<string, unknown>;
      huddleScheduleMetadata?: Record<string, unknown>;
      huddleMeetingLink?: string;
      mentorHuddleNotes?: string;
      huddleAttendanceRequired?: boolean;
    },
  ): Promise<WeeklyModule> {
    return this.prisma.weeklyModule.create({
      data: {
        organizationId: scope.organizationId,
        ...data,
        unlockRules: data.unlockRules as Prisma.InputJsonValue,
        huddleScheduleMetadata: data.huddleScheduleMetadata as Prisma.InputJsonValue,
      } as Prisma.WeeklyModuleUncheckedCreateInput,
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    data: Prisma.WeeklyModuleUpdateInput,
    expectedVersion: number,
  ): Promise<WeeklyModule> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.weeklyModule.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      if (current.version !== expectedVersion) {
        throw new WeeklyModuleVersionConflictError(current.version);
      }
      return tx.weeklyModule.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  async updateStatus(
    id: string,
    status: CurriculumStatus,
    expectedVersion: number,
  ): Promise<WeeklyModule> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.weeklyModule.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new WeeklyModuleVersionConflictError(current.version);
      }
      return tx.weeklyModule.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
    });
  }

  archive(id: string): Promise<WeeklyModule> {
    return this.prisma.weeklyModule.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  restore(id: string): Promise<WeeklyModule> {
    return this.prisma.weeklyModule.update({
      where: { id },
      data: { status: 'draft', deletedAt: null, version: { increment: 1 } },
    });
  }
}

export class WeeklyModuleVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Weekly module has been modified since it was last read.');
  }
}
