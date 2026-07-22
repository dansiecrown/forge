import { Injectable } from '@nestjs/common';
import type { Organization } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

/** Minimal stub repository — Organization exists only as the tenant FK
 * anchor Membership requires. Full administration is out of scope for the
 * Identity & Access Control milestone. */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { slug } });
  }
}
