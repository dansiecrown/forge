import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  CreateCertificateTemplateDto,
  IssueCertificateDto,
  RevokeCertificateDto,
} from '../dtos/certificate.dto';
import { CertificatesService } from '../services/certificates.service';

@Controller('admin/certificates')
export class AdminCertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  @RequirePermissions('certificate.read')
  list(
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.certificatesService.listForOrganization(
      { organizationId: requireOrganizationId(organizationId) },
      { cursor, limit },
    );
  }

  @Get('templates')
  @RequirePermissions('certificate.manage')
  listTemplates(@ActiveOrganizationId() organizationId: string | undefined) {
    return this.certificatesService.listTemplates({
      organizationId: requireOrganizationId(organizationId),
    });
  }

  @Post('templates')
  @RequirePermissions('certificate.manage')
  createTemplate(
    @Body() dto: CreateCertificateTemplateDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.certificatesService.createTemplate(
      { organizationId: requireOrganizationId(organizationId) },
      dto,
      user.id,
    );
  }

  @Post()
  @RequirePermissions('certificate.manage')
  issue(
    @Body() dto: IssueCertificateDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.certificatesService.issue(
      { organizationId: requireOrganizationId(organizationId) },
      dto.enrollmentId,
      dto.certificateTemplateId,
      user.id,
    );
  }

  @Post(':id/actions/revoke')
  @RequirePermissions('certificate.manage')
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeCertificateDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.certificatesService.revoke(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.reason,
      dto.version,
      user.id,
    );
  }
}

@Controller('admin/enrollments/:enrollmentId/certificate-eligibility')
export class AdminCertificateEligibilityController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  @RequirePermissions('certificate.read')
  check(
    @Param('enrollmentId') enrollmentId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.certificatesService.checkEligibility(
      { organizationId: requireOrganizationId(organizationId) },
      enrollmentId,
      user.id,
    );
  }
}
