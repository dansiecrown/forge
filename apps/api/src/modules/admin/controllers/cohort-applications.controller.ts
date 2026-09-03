import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { Public } from '../../../decorators/public.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  CohortApplicationTransitionDto,
  SubmitProspectApplicationDto,
  SubmitStudentApplicationDto,
} from '../dtos/cohort-application.dto';
import { CohortApplicationsService } from '../services/cohort-applications.service';

/** Authenticated self-service — an existing org member applying to one of
 * their own organization's public cohorts. See
 * `PublicCohortApplicationsController` below for the anonymous-prospect
 * equivalent. */
@Controller('cohort-applications')
export class CohortApplicationsController {
  constructor(private readonly cohortApplicationsService: CohortApplicationsService) {}

  @Post()
  @RequirePermissions('cohort.application.submit')
  submit(
    @Body() dto: SubmitStudentApplicationDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortApplicationsService.submitAsStudent(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      dto,
    );
  }

  @Get('me')
  @RequirePermissions('cohort.application.submit')
  listMine(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cohortApplicationsService.listMine(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
      { cursor, limit },
    );
  }

  @Post(':id/actions/withdraw')
  @RequirePermissions('cohort.application.submit')
  withdraw(
    @Param('id') id: string,
    @Body() dto: CohortApplicationTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortApplicationsService.withdraw(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}

/** Anonymous — no auth, no `X-Organization-Id`; the target organization is
 * resolved server-side from the chosen `cohortId`. See
 * docs/adr/0010-cohort-applications.md. */
@Controller('public/cohort-applications')
export class PublicCohortApplicationsController {
  constructor(private readonly cohortApplicationsService: CohortApplicationsService) {}

  @Post()
  @Public()
  submit(@Body() dto: SubmitProspectApplicationDto) {
    return this.cohortApplicationsService.submitAsProspect(dto);
  }
}
