import { Injectable } from '@nestjs/common';
import type { CertificateTemplate } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface CreateCertificateTemplateInput {
  fellowshipId?: string;
  name: string;
  bodyHtml: string;
}

@Injectable()
export class CertificateTemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(scope: TenantScope): Promise<CertificateTemplate[]> {
    return this.prisma.certificateTemplate.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(scope: TenantScope, id: string): Promise<CertificateTemplate | null> {
    return this.prisma.certificateTemplate.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  create(scope: TenantScope, input: CreateCertificateTemplateInput): Promise<CertificateTemplate> {
    return this.prisma.certificateTemplate.create({
      data: { organizationId: scope.organizationId, ...input },
    });
  }
}
