import { Injectable } from '@nestjs/common';
import type { Certificate, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface IssueCertificateInput {
  enrollmentId: string;
  fellowshipId: string;
  certificateTemplateId: string;
  verificationCode: string;
  eligibilitySnapshot: Prisma.InputJsonValue;
  issuedByUserId: string;
}

export interface ListCertificatesOptions {
  cursor?: string;
  limit: number;
}

@Injectable()
export class CertificatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: TenantScope,
    options: ListCertificatesOptions,
  ): Promise<{ rows: Certificate[]; hasMore: boolean }> {
    const rows = await this.prisma.certificate.findMany({
      where: { organizationId: scope.organizationId },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }

  findById(id: string): Promise<Certificate | null> {
    return this.prisma.certificate.findUnique({ where: { id } });
  }

  findByEnrollmentAndFellowship(
    enrollmentId: string,
    fellowshipId: string,
  ): Promise<Certificate | null> {
    return this.prisma.certificate.findUnique({
      where: { enrollmentId_fellowshipId: { enrollmentId, fellowshipId } },
    });
  }

  findByVerificationCode(code: string): Promise<Certificate | null> {
    return this.prisma.certificate.findUnique({ where: { verificationCode: code } });
  }

  issue(scope: TenantScope, input: IssueCertificateInput): Promise<Certificate> {
    return this.prisma.certificate.create({
      data: {
        organizationId: scope.organizationId,
        enrollmentId: input.enrollmentId,
        fellowshipId: input.fellowshipId,
        certificateTemplateId: input.certificateTemplateId,
        verificationCode: input.verificationCode,
        status: 'issued',
        eligibilitySnapshot: input.eligibilitySnapshot,
        issuedAt: new Date(),
        issuedByUserId: input.issuedByUserId,
      },
    });
  }

  async revoke(
    id: string,
    reason: string,
    revokedByUserId: string,
    expectedVersion: number,
  ): Promise<Certificate> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.certificate.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) {
        throw new CertificateVersionConflictError(current.version);
      }
      return tx.certificate.update({
        where: { id },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokedByUserId,
          revokeReason: reason,
          version: { increment: 1 },
        },
      });
    });
  }
}

export class CertificateVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Certificate has been modified since it was last read.');
  }
}
