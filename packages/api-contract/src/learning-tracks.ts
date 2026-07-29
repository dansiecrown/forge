// Hand-authored request/response contracts for the Learning Tracks endpoints
// (Milestone 4 — Curriculum & Learning Engine). See
// docs/adr/0006-curriculum-learning-engine.md — not documented in
// docs/api-specification.md, which predates this entity.

export interface LearningTrack {
  id: string;
  organizationId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  description: string | null;
  iconMetadata: Record<string, unknown> | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedWeeks: number | null;
  status: 'draft' | 'published' | 'archived';
  displayOrder: number;
  prerequisitesMetadata: Record<string, unknown> | null;
  learningOutcomes: string[];
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningTrackRequest {
  name: string;
  slug: string;
  description?: string;
  iconMetadata?: Record<string, unknown>;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedWeeks?: number;
  prerequisitesMetadata?: Record<string, unknown>;
  learningOutcomes?: string[];
  tags?: string[];
}

export interface UpdateLearningTrackRequest {
  name?: string;
  description?: string;
  iconMetadata?: Record<string, unknown>;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedWeeks?: number;
  prerequisitesMetadata?: Record<string, unknown>;
  learningOutcomes?: string[];
  tags?: string[];
}

export interface ListLearningTracksParams {
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface ReorderItem {
  id: string;
  displayOrder: number;
}
