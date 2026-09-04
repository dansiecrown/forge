import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormField } from '@/components/form-field';
import { SelectField } from '@/components/select-field';
import { TextareaField } from '@/components/textarea-field';
import { useActiveOrganization } from '@/contexts/organization-context';
import {
  checkEligibility,
  createCertificateTemplate,
  issueCertificate,
  listCertificateTemplates,
  listCertificates,
  revokeCertificate,
} from '../api/certificates-api';

const STATUS_TONE: Record<string, BadgeProps['tone']> = {
  pending: 'neutral',
  issued: 'success',
  revoked: 'danger',
};

export function CertificatesPage() {
  const { activeOrganizationId } = useActiveOrganization();
  const orgId = activeOrganizationId as string;
  const queryClient = useQueryClient();

  const certificates = useQuery({
    queryKey: ['certificates', orgId],
    queryFn: () => listCertificates(orgId),
    enabled: Boolean(orgId),
  });
  const templates = useQuery({
    queryKey: ['certificate-templates', orgId],
    queryFn: () => listCertificateTemplates(orgId),
    enabled: Boolean(orgId),
  });

  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState(
    '<h1>Certificate of Completion</h1><p>{{studentName}} has completed {{fellowshipTitle}}.</p>',
  );
  const createTemplate = useMutation({
    mutationFn: () =>
      createCertificateTemplate({ name: templateName, bodyHtml: templateBody }, orgId),
    onSuccess: () => {
      setTemplateName('');
      void queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
  });

  const [enrollmentId, setEnrollmentId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const eligibility = useMutation({
    mutationFn: () => checkEligibility(enrollmentId, orgId),
  });
  const issue = useMutation({
    mutationFn: () => issueCertificate({ enrollmentId, certificateTemplateId: templateId }, orgId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  });
  const revoke = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      revokeCertificate(id, version, 'Revoked by administrator', orgId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  });
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; version: number } | null>(null);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Certificate Management"
        description="Templates, issuance, and verification. PDF generation happens in the browser (print)."
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Check eligibility &amp; issue</CardTitle>
        </CardHeader>
        <CardContent>
          {issue.error instanceof ApiError ? (
            <Alert variant="danger">{issue.error.message}</Alert>
          ) : null}
          <FormField
            label="Enrollment id"
            name="enrollmentId"
            value={enrollmentId}
            onChange={(e) => setEnrollmentId(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              loading={eligibility.isPending}
              onClick={() => eligibility.mutate()}
            >
              Check eligibility
            </Button>
          </div>
          {eligibility.data ? (
            <div
              className={`rounded-control border p-3 text-sm ${eligibility.data.eligible ? 'border-success/40 bg-success/5 text-success' : 'border-warning/40 bg-warning/5 text-warning'}`}
            >
              {eligibility.data.eligible ? (
                'This enrollment meets every eligibility criterion.'
              ) : (
                <ul className="list-disc space-y-1 pl-4">
                  {eligibility.data.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <SelectField
            label="Certificate template"
            name="templateId"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Select a template…</option>
            {templates.data?.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </SelectField>
          <div className="flex justify-end">
            <Button
              loading={issue.isPending}
              disabled={!enrollmentId || !templateId}
              onClick={() => issue.mutate()}
            >
              Issue certificate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Certificate templates</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            label="Template name"
            name="templateName"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <TextareaField
            label={`Body HTML (supports {{studentName}}, {{fellowshipTitle}})`}
            name="templateBody"
            value={templateBody}
            onChange={(e) => setTemplateBody(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end">
            <Button
              variant="secondary"
              loading={createTemplate.isPending}
              disabled={!templateName}
              onClick={() => createTemplate.mutate()}
            >
              Save template
            </Button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {templates.data?.map((template) => (
              <li key={template.id}>{template.name}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Issued certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {certificates.data?.items.length ? (
            <ul className="space-y-2">
              {certificates.data.items.map((certificate) => (
                <li
                  key={certificate.id}
                  className="flex items-center justify-between rounded-control border border-border p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-foreground">
                      {certificate.verificationCode}
                    </span>
                    <Badge tone={STATUS_TONE[certificate.status]}>{certificate.status}</Badge>
                  </div>
                  {certificate.status === 'issued' ? (
                    <Button
                      variant="destructive"
                      onClick={() =>
                        setRevokeTarget({ id: certificate.id, version: certificate.version })
                      }
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No certificates issued yet.</p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revoke.mutateAsync(revokeTarget);
            setRevokeTarget(null);
          } catch {
            // surfaced below via revoke.error
          }
        }}
        loading={revoke.isPending}
        error={revoke.error instanceof ApiError ? revoke.error.message : null}
        title="Revoke this certificate?"
        description="Its verification code will no longer verify."
        confirmLabel="Revoke"
      />
    </div>
  );
}
