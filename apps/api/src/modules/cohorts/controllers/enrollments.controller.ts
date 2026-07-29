import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { CreateEnrollmentDto, UpdateEnrollmentDto } from '../dtos/enrollment.dto';
import { EnrollmentsService } from '../services/enrollments.service';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('cohorts/:cohortId/enrollments')
  @RequirePermissions('enrollment.read')
  list(
    @Param('cohortId') cohortId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.enrollmentsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      { cohortId, status, cursor, limit },
    );
  }

  @Post('cohorts/:cohortId/enrollments')
  @RequirePermissions('enrollment.manage')
  create(
    @Param('cohortId') cohortId: string,
    @Body() dto: CreateEnrollmentDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.enrollmentsService.create(
      { organizationId: requireOrganizationId(organizationId) },
      cohortId,
      dto.studentUserId,
      user.id,
    );
  }

  /** Self-lookup, not the generic staff-facing `enrollment.read` — ownership
   * is inherent (filtered to the caller's own userId). Reuses
   * `enrollment.progress.read` (already granted to every role including
   * STUDENT) purely so `PermissionsGuard` resolves `request.organizationId`
   * from `X-Organization-Id`; it grants no broader access. Must be declared
   * before `enrollments/:id` so `me` isn't swallowed by the `:id` param. */
  @Get('enrollments/me')
  @RequirePermissions('enrollment.progress.read')
  listMine(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.enrollmentsService.listMine(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      { cursor, limit },
    );
  }

  @Get('enrollments/:id')
  @RequirePermissions('enrollment.read')
  get(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
    return this.enrollmentsService.get(
      { organizationId: requireOrganizationId(organizationId) },
      id,
    );
  }

  @Patch('enrollments/:id')
  @RequirePermissions('enrollment.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.enrollmentsService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }
}
