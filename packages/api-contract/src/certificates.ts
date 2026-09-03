// Hand-authored request/response contracts for Certificate Management. See
// organizations.ts for the pattern this follows. PDF generation is entirely
// client-side (browser print) — the backend only serves template HTML/data.

export interface CertificateTemplate {
  id: string;
  fellowshipId: string | null;
  name: string;
  bodyHtml: string;
  status: string;
  version: number;
}

export interface CreateCertificateTemplateRequest {
  fellowshipId?: string;
  name: string;
  bodyHtml: string;
}

export interface Certificate {
  id: string;
  enrollmentId: string;
  fellowshipId: string;
  certificateTemplateId: string;
  verificationCode: string;
  status: 'pending' | 'issued' | 'revoked';
  issuedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  version: number;
  createdAt: string;
}

export interface IssueCertificateRequest {
  enrollmentId: string;
  certificateTemplateId: string;
}

export interface RevokeCertificateRequest {
  version: number;
  reason: string;
}

export interface CertificateEligibility {
  eligible: boolean;
  lessonCompletionRate: number;
  attendanceRate: number;
  allRequiredWorkApproved: boolean;
  reasons: string[];
}

export interface PublicCertificateVerification {
  verificationCode: string;
  status: string;
  issuedAt: string | null;
}
