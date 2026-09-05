// Hand-authored request/response contracts for the Lessons endpoints
// (Milestone 4 — Curriculum & Learning Engine).

export type LessonType =
  | 'video'
  | 'article'
  | 'documentation'
  | 'reading'
  | 'external_resource'
  | 'live_session_reference'
  | 'embedded_content';

export interface Lesson {
  id: string;
  organizationId: string;
  weeklyModuleId: string;
  title: string;
  description: string | null;
  lessonType: LessonType;
  estimatedDurationMinutes: number | null;
  resourceUrl: string | null;
  attachmentMetadata: Record<string, unknown> | null;
  embeddedContentMetadata: Record<string, unknown> | null;
  displayOrder: number;
  completionRequired: boolean;
  status: 'draft' | 'published' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonRequest {
  title: string;
  description?: string;
  lessonType: LessonType;
  estimatedDurationMinutes?: number;
  resourceUrl?: string;
  attachmentMetadata?: Record<string, unknown>;
  embeddedContentMetadata?: Record<string, unknown>;
  completionRequired?: boolean;
}

export interface UpdateLessonRequest {
  title?: string;
  description?: string;
  lessonType?: LessonType;
  estimatedDurationMinutes?: number;
  resourceUrl?: string;
  attachmentMetadata?: Record<string, unknown>;
  embeddedContentMetadata?: Record<string, unknown>;
  completionRequired?: boolean;
}

export interface ListLessonsParams {
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}
