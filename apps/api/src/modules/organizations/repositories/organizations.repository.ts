import { Injectable } from '@nestjs/common';
import type { Organization, OrganizationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface ListOrganizationsOptions {
  status?: OrganizationStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    options: ListOrganizationsOptions,
  ): Promise<{ rows: Organization[]; hasMore: boolean }> {
    const where: Prisma.OrganizationWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
    };

    const rows = await this.prisma.organization.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { slug } });
  }

  create(data: {
    name: string;
    slug: string;
    legalName?: string;
    defaultTimezone?: string;
    country?: string;
    supportEmail?: string;
  }): Promise<Organization> {
    return this.prisma.organization.create({ data });
  }

  async update(
    id: string,
    data: Prisma.OrganizationUpdateInput,
    expectedVersion: number,
  ): Promise<Organization> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.organization.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new OrganizationVersionConflictError(current.version);
      }
      return tx.organization.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }

  updateStatus(id: string, status: OrganizationStatus): Promise<Organization> {
    return this.prisma.organization.update({
      where: { id },
      data: { status, version: { increment: 1 } },
    });
  }
}

export class OrganizationVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Organization has been modified since it was last read.');
  }
}
