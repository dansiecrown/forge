// Hand-authored request/response contracts for the Fellowships endpoints
// (docs/api-specification.md §4.4, top-level programme only — courses/
// curriculum are out of scope for Milestone 3).

export interface Fellowship {
  id: string;
  organizationId: string;
  academyId: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'retired';
  durationWeeks: number;
  description: string | null;
  summary: string | null;
  defaultCapacity: number | null;
  isPublic: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  eligibilityMetadata: Record<string, unknown> | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFellowshipRequest {
  academyId: string;
  title: string;
  slug: string;
  durationWeeks: number;
  summary?: string;
  description?: string;
  defaultCapacity?: number;
  isPublic?: boolean;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  eligibilityMetadata?: Record<string, unknown>;
}

export interface UpdateFellowshipRequest {
  title?: string;
  durationWeeks?: number;
  summary?: string;
  description?: string;
  defaultCapacity?: number;
  isPublic?: boolean;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  eligibilityMetadata?: Record<string, unknown>;
}

export interface ListFellowshipsParams {
  academyId?: string;
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}
