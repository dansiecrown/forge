// Hand-authored request/response contracts for the student Portfolio
// endpoints (Milestone 5 — Student Experience). A deliberately lighter
// entity than the fuller documented Portfolio/consent system — see
// docs/adr/0007-student-experience.md Decision 2. `publicSlug` is stored
// but never served by a real unauthenticated route ("placeholder only").

export interface PortfolioProject {
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
  completionDate: string;
  visibility: 'private' | 'public';
  publicSlug: string | null;
  publishedAt: string | null;
  displayOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePortfolioProjectRequest {
  practicalTaskSubmissionId: string;
  title: string;
  description?: string;
  technologies?: string[];
  skillsAcquired?: string[];
  repositoryUrl?: string;
  liveDemoUrl?: string;
  completionDate: string;
}

export interface UpdatePortfolioProjectRequest {
  title?: string;
  description?: string;
  technologies?: string[];
  skillsAcquired?: string[];
  repositoryUrl?: string;
  liveDemoUrl?: string;
  completionDate?: string;
}
