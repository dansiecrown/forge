// Hand-authored request/response contracts for the Courses endpoints
// (Milestone 4 — Curriculum & Learning Engine).

export interface Course {
  id: string;
  organizationId: string;
  learningTrackId: string;
  title: string;
  slug: string;
  overview: string | null;
  objectives: string[];
  completionCriteria: string | null;
  estimatedHours: number | null;
  status: 'draft' | 'published' | 'archived';
  displayOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCourseRequest {
  title: string;
  slug: string;
  overview?: string;
  objectives?: string[];
  completionCriteria?: string;
  estimatedHours?: number;
}

export interface UpdateCourseRequest {
  title?: string;
  overview?: string;
  objectives?: string[];
  completionCriteria?: string;
  estimatedHours?: number;
}

export interface ListCoursesParams {
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}
