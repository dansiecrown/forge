import type { LearningTrack } from '@prisma/client';

export interface LearningTrackEntity {
  id: string;
  organizationId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  description: string | null;
  iconMetadata: unknown;
  difficulty: string;
  estimatedWeeks: number | null;
  status: string;
  displayOrder: number;
  prerequisitesMetadata: unknown;
  learningOutcomes: string[];
  tags: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toLearningTrackEntity(row: LearningTrack): LearningTrackEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fellowshipId: row.fellowshipId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    iconMetadata: row.iconMetadata,
    difficulty: row.difficulty,
    estimatedWeeks: row.estimatedWeeks,
    status: row.status,
    displayOrder: row.displayOrder,
    prerequisitesMetadata: row.prerequisitesMetadata,
    learningOutcomes: row.learningOutcomes,
    tags: row.tags,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
