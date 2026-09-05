import type { Course } from '@prisma/client';

export interface CourseEntity {
  id: string;
  organizationId: string;
  learningTrackId: string;
  title: string;
  slug: string;
  overview: string | null;
  objectives: string[];
  completionCriteria: string | null;
  estimatedHours: number | null;
  status: string;
  displayOrder: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCourseEntity(row: Course): CourseEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    learningTrackId: row.learningTrackId,
    title: row.title,
    slug: row.slug,
    overview: row.overview,
    objectives: row.objectives,
    completionCriteria: row.completionCriteria,
    estimatedHours: row.estimatedHours,
    status: row.status,
    displayOrder: row.displayOrder,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
