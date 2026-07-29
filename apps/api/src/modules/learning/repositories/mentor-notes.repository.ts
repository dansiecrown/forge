import { Injectable } from '@nestjs/common';
import type { MentorNote } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

@Injectable()
export class MentorNotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first — a running log, not a form. */
  list(scope: TenantScope, enrollmentId: string): Promise<MentorNote[]> {
    return this.prisma.mentorNote.findMany({
      where: { organizationId: scope.organizationId, enrollmentId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Mentor dashboard's "recent notes I've written" widget. */
  listRecentByAuthor(
    scope: TenantScope,
    authorMembershipId: string,
    take: number,
  ): Promise<MentorNote[]> {
    return this.prisma.mentorNote.findMany({
      where: { organizationId: scope.organizationId, authorMembershipId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  findById(scope: TenantScope, id: string): Promise<MentorNote | null> {
    return this.prisma.mentorNote.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  create(
    scope: TenantScope,
    data: { cohortId: string; enrollmentId: string; authorMembershipId: string; body: string },
  ): Promise<MentorNote> {
    return this.prisma.mentorNote.create({
      data: { organizationId: scope.organizationId, ...data },
    });
  }

  async update(
    scope: TenantScope,
    id: string,
    body: string,
    expectedVersion: number,
  ): Promise<MentorNote> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.mentorNote.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });
      if (current.version !== expectedVersion) {
        throw new MentorNoteVersionConflictError(current.version);
      }
      return tx.mentorNote.update({
        where: { id },
        data: { body, version: { increment: 1 } },
      });
    });
  }

  async softDelete(scope: TenantScope, id: string, expectedVersion: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.mentorNote.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
      });
      if (current.version !== expectedVersion) {
        throw new MentorNoteVersionConflictError(current.version);
      }
      await tx.mentorNote.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    });
  }
}

export class MentorNoteVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Mentor note has been modified since it was last read.');
  }
}
