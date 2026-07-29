import type { PortfolioProject } from '@prisma/client';

export interface PortfolioProjectEntity {
  id: string;
  organizationId: string;
  enrollmentId: string;
  practicalTaskSubmissionId: string;
  title: string;
  description: string | null;
  technologies: string[];
  skillsAcquired: string[];
  repositoryUrl: string | null;
  liveDemoUrl: string | null;
  completionDate: Date;
  visibility: string;
  publicSlug: string | null;
  publishedAt: Date | null;
  displayOrder: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toPortfolioProjectEntity(row: PortfolioProject): PortfolioProjectEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    enrollmentId: row.enrollmentId,
    practicalTaskSubmissionId: row.practicalTaskSubmissionId,
    title: row.title,
    description: row.description,
    technologies: row.technologies,
    skillsAcquired: row.skillsAcquired,
    repositoryUrl: row.repositoryUrl,
    liveDemoUrl: row.liveDemoUrl,
    completionDate: row.completionDate,
    visibility: row.visibility,
    publicSlug: row.publicSlug,
    publishedAt: row.publishedAt,
    displayOrder: row.displayOrder,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
