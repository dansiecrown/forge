import { Injectable } from '@nestjs/common';
import type { ResourceAcknowledgment } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ResourceAcknowledgmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent, same reasoning as LessonCompletionsRepository. */
  recordAcknowledgment(enrollmentId: string, resourceId: string): Promise<ResourceAcknowledgment> {
    return this.prisma.resourceAcknowledgment.upsert({
      where: { enrollmentId_resourceId: { enrollmentId, resourceId } },
      update: {},
      create: { enrollmentId, resourceId },
    });
  }

  listForEnrollment(enrollmentId: string): Promise<ResourceAcknowledgment[]> {
    return this.prisma.resourceAcknowledgment.findMany({ where: { enrollmentId } });
  }
}
