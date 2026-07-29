import type { LearningResource } from '@prisma/client';

export interface LearningResourceEntity {
  id: string;
  organizationId: string;
  weeklyModuleId: string;
  lessonId: string | null;
  resourceType: string;
  url: string | null;
  title: string;
  author: string | null;
  provider: string | null;
  estimatedDurationMinutes: number | null;
  isRequired: boolean;
  notes: string | null;
  displayOrder: number;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toLearningResourceEntity(row: LearningResource): LearningResourceEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    weeklyModuleId: row.weeklyModuleId,
    lessonId: row.lessonId,
    resourceType: row.resourceType,
    url: row.url,
    title: row.title,
    author: row.author,
    provider: row.provider,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    isRequired: row.isRequired,
    notes: row.notes,
    displayOrder: row.displayOrder,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
