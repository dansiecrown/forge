import { Injectable } from '@nestjs/common';
import type { LessonCompletion } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LessonCompletionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent — completing the same lesson twice is a no-op, not an
   * error (docs/development-roadmap.md's "completion is idempotent"
   * principle, applied here even though the student portal it describes is
   * out of scope this milestone). */
  recordCompletion(enrollmentId: string, lessonId: string): Promise<LessonCompletion> {
    return this.prisma.lessonCompletion.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      update: {},
      create: { enrollmentId, lessonId },
    });
  }

  listForEnrollment(enrollmentId: string): Promise<LessonCompletion[]> {
    return this.prisma.lessonCompletion.findMany({ where: { enrollmentId } });
  }
}
