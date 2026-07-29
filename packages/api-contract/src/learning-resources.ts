// Hand-authored request/response contracts for the Learning Resources
// endpoints (Milestone 4 — Curriculum & Learning Engine).

export type LearningResourceType =
  | 'udemy_course'
  | 'youtube_video'
  | 'official_documentation'
  | 'github_repository'
  | 'pdf'
  | 'article'
  | 'book'
  | 'other';

export interface LearningResource {
  id: string;
  organizationId: string;
  weeklyModuleId: string;
  lessonId: string | null;
  resourceType: LearningResourceType;
  url: string | null;
  title: string;
  author: string | null;
  provider: string | null;
  estimatedDurationMinutes: number | null;
  isRequired: boolean;
  notes: string | null;
  displayOrder: number;
  status: 'draft' | 'published' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningResourceRequest {
  resourceType: LearningResourceType;
  url?: string;
  title: string;
  lessonId?: string;
  author?: string;
  provider?: string;
  estimatedDurationMinutes?: number;
  isRequired?: boolean;
  notes?: string;
}

export interface UpdateLearningResourceRequest {
  resourceType?: LearningResourceType;
  url?: string;
  title?: string;
  lessonId?: string;
  author?: string;
  provider?: string;
  estimatedDurationMinutes?: number;
  isRequired?: boolean;
  notes?: string;
}

export interface ListLearningResourcesParams {
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}
