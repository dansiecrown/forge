// Hand-authored request/response contracts for the Academies endpoints
// (docs/api-specification.md §4.3).

export interface Academy {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: 'active' | 'archived';
  description: string | null;
  timezone: string;
  branding: Record<string, unknown> | null;
  contactEmail: string | null;
  isPublic: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAcademyRequest {
  name: string;
  slug: string;
  timezone?: string;
  description?: string;
  contactEmail?: string;
  branding?: Record<string, unknown>;
  isPublic?: boolean;
}

export interface UpdateAcademyRequest {
  name?: string;
  description?: string;
  timezone?: string;
  contactEmail?: string;
  branding?: Record<string, unknown>;
  isPublic?: boolean;
}

export interface ListAcademiesParams {
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}
