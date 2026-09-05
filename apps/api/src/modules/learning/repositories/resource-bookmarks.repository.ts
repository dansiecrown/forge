import { Injectable } from '@nestjs/common';
import type { ResourceBookmark } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ResourceBookmarksRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForEnrollment(enrollmentId: string): Promise<ResourceBookmark[]> {
    return this.prisma.resourceBookmark.findMany({ where: { enrollmentId } });
  }

  /** Idempotent create — bookmarking an already-bookmarked resource is a
   * no-op, not an error. */
  add(enrollmentId: string, resourceId: string): Promise<ResourceBookmark> {
    return this.prisma.resourceBookmark.upsert({
      where: { enrollmentId_resourceId: { enrollmentId, resourceId } },
      update: {},
      create: { enrollmentId, resourceId },
    });
  }

  /** Idempotent remove — un-bookmarking a resource that isn't bookmarked is
   * a no-op, not an error. A bookmark is a plain toggle: no soft delete, no
   * version, hard delete on removal. */
  async remove(enrollmentId: string, resourceId: string): Promise<void> {
    await this.prisma.resourceBookmark.deleteMany({ where: { enrollmentId, resourceId } });
  }
}
