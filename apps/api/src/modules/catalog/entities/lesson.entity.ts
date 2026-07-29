import type { Lesson } from '@prisma/client';

export interface LessonEntity {
  id: string;
  organizationId: string;
  weeklyModuleId: string;
  title: string;
  description: string | null;
  lessonType: string;
  estimatedDurationMinutes: number | null;
  resourceUrl: string | null;
  attachmentMetadata: unknown;
  embeddedContentMetadata: unknown;
  displayOrder: number;
  completionRequired: boolean;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toLessonEntity(row: Lesson): LessonEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    weeklyModuleId: row.weeklyModuleId,
    title: row.title,
    description: row.description,
    lessonType: row.lessonType,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    resourceUrl: row.resourceUrl,
    attachmentMetadata: row.attachmentMetadata,
    embeddedContentMetadata: row.embeddedContentMetadata,
    displayOrder: row.displayOrder,
    completionRequired: row.completionRequired,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
