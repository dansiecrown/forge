import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { AcademyActionReasonDto, CreateAcademyDto, UpdateAcademyDto } from '../dtos/academy.dto';
import { AcademiesService } from '../services/academies.service';

@Controller()
export class AcademiesController {
  constructor(private readonly academiesService: AcademiesService) {}

  @Get('academies')
  @RequirePermissions('academy.read')
  list(
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.academiesService.list(
      { organizationId: requireOrganizationId(organizationId) },
      { status, q, cursor, limit },
    );
  }

  @Post('academies')
  @RequirePermissions('academy.create')
  create(
    @Body() dto: CreateAcademyDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.academiesService.create(
      { organizationId: requireOrganizationId(organizationId) },
      dto,
      user.id,
    );
  }

  @Get('academies/:academyId')
  @RequirePermissions('academy.read')
  get(
    @Param('academyId') academyId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
  ) {
    return this.academiesService.get(
      { organizationId: requireOrganizationId(organizationId) },
      academyId,
    );
  }

  @Patch('academies/:academyId')
  @RequirePermissions('academy.update')
  update(
    @Param('academyId') academyId: string,
    @Body() dto: UpdateAcademyDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.academiesService.update(
      { organizationId: requireOrganizationId(organizationId) },
      academyId,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('academies/:academyId/actions/archive')
  @RequirePermissions('academy.archive')
  archive(
    @Param('academyId') academyId: string,
    @Body() _dto: AcademyActionReasonDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.academiesService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      academyId,
      user.id,
    );
  }

  @Post('academies/:academyId/actions/restore')
  @RequirePermissions('academy.restore')
  restore(
    @Param('academyId') academyId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.academiesService.restore(
      { organizationId: requireOrganizationId(organizationId) },
      academyId,
      user.id,
    );
  }
}
