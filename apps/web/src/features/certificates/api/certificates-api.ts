import type {
  Certificate,
  CertificateEligibility,
  CertificateTemplate,
  CreateCertificateTemplateRequest,
  IssueCertificateRequest,
  PublicCertificateVerification,
} from '@forge/api-contract';
import { apiRequest, apiRequestPage, type Page } from '@/api/client';

export function listCertificates(organizationId: string): Promise<Page<Certificate>> {
  return apiRequestPage<Certificate>('/admin/certificates', { organizationId });
}

export function listCertificateTemplates(organizationId: string): Promise<CertificateTemplate[]> {
  return apiRequest<CertificateTemplate[]>('/admin/certificates/templates', { organizationId });
}

export function createCertificateTemplate(
  body: CreateCertificateTemplateRequest,
  organizationId: string,
): Promise<CertificateTemplate> {
  return apiRequest<CertificateTemplate>('/admin/certificates/templates', {
    method: 'POST',
    body,
    organizationId,
  });
}

export function checkEligibility(
  enrollmentId: string,
  organizationId: string,
): Promise<CertificateEligibility> {
  return apiRequest<CertificateEligibility>(
    `/admin/enrollments/${enrollmentId}/certificate-eligibility`,
    { organizationId },
  );
}

export function issueCertificate(
  body: IssueCertificateRequest,
  organizationId: string,
): Promise<Certificate> {
  return apiRequest<Certificate>('/admin/certificates', { method: 'POST', body, organizationId });
}

export function revokeCertificate(
  id: string,
  version: number,
  reason: string,
  organizationId: string,
): Promise<Certificate> {
  return apiRequest<Certificate>(`/admin/certificates/${id}/actions/revoke`, {
    method: 'POST',
    body: { version, reason },
    organizationId,
  });
}

export function verifyCertificate(code: string): Promise<PublicCertificateVerification> {
  return apiRequest<PublicCertificateVerification>(`/public/certificates/verify/${code}`, {
    authenticated: false,
  });
}
