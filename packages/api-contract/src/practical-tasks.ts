// Hand-authored request/response contracts for the Practical Tasks endpoints
// (Milestone 4 — Curriculum & Learning Engine). Deliberately lighter than
// docs/database-design.md's graded Assignment/Submission system — no
// grading, no attempts, per the milestone brief's explicit "Do NOT build
// grading yet." See docs/adr/0006-curriculum-learning-engine.md.

export interface PracticalTask {
  id: string;
  organizationId: string;
  weeklyModuleId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  deliverables: string[];
  submissionTypeMetadata: Record<string, unknown> | null;
  dueOffsetDays: number | null;
  rubricMetadata: Record<string, unknown> | null;
  maxScore: number | null;
  displayOrder: number;
  status: 'draft' | 'published' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePracticalTaskRequest {
  title: string;
  description?: string;
  instructions?: string;
  deliverables?: string[];
  submissionTypeMetadata?: Record<string, unknown>;
  dueOffsetDays?: number;
  rubricMetadata?: Record<string, unknown>;
  maxScore?: number;
}

export interface UpdatePracticalTaskRequest {
  title?: string;
  description?: string;
  instructions?: string;
  deliverables?: string[];
  submissionTypeMetadata?: Record<string, unknown>;
  dueOffsetDays?: number;
  rubricMetadata?: Record<string, unknown>;
  maxScore?: number;
}

export interface ListPracticalTasksParams {
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}
