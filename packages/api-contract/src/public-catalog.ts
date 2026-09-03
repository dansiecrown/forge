// Hand-authored request/response contracts for the public, unauthenticated
// fellowship/cohort catalog browse — see cohort-applications.ts and
// docs/adr/0010-cohort-applications.md. No organizationId anywhere in this
// file: the catalog is a genuinely cross-tenant read.

export interface PublicCatalogTrack {
  id: string;
  name: string;
  slug: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface PublicCatalogCohort {
  id: string;
  name: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
}

export interface PublicCatalogFellowship {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  durationWeeks: number;
  academyId: string;
  academyName: string;
  cohorts: PublicCatalogCohort[];
  tracks: PublicCatalogTrack[];
}

export interface ListPublicFellowshipsParams {
  cursor?: string;
  limit?: number;
}
