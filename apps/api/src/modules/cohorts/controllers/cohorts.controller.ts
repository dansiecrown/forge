import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  AssignCohortMentorDto,
  CohortTransitionDto,
  CreateCohortDto,
  SetCohortTracksDto,
  UpdateCohortDto,
} from '../dtos/cohort.dto';
import { CohortsService } from '../services/cohorts.service';

@Controller()
export class CohortsController {
  constructor(private readonly cohortsService: CohortsService) {}

  @Get('cohorts')
  @RequirePermissions('cohort.read')
  list(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('fellowshipId') fellowshipId?: string,
    @Query('academyId') academyId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cohortsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      { fellowshipId, academyId, status, q, cursor, limit },
      user.id,
    );
  }

  @Post('cohorts')
  @RequirePermissions('cohort.create')
  create(
    @Body() dto: CreateCohortDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.create(
      { organizationId: requireOrganizationId(organizationId) },
      dto,
      user.id,
    );
  }

  @Get('cohorts/:id')
  @RequirePermissions('cohort.read')
  get(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.get(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Patch('cohorts/:id')
  @RequirePermissions('cohort.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCohortDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('cohorts/:id/actions/activate')
  @RequirePermissions('cohort.activate')
  activate(
    @Param('id') id: string,
    @Body() dto: CohortTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.activate(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('cohorts/:id/actions/pause')
  @RequirePermissions('cohort.pause')
  pause(
    @Param('id') id: string,
    @Body() dto: CohortTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.pause(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('cohorts/:id/actions/complete')
  @RequirePermissions('cohort.complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CohortTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.complete(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('cohorts/:id/actions/archive')
  @RequirePermissions('cohort.archive')
  archive(
    @Param('id') id: string,
    @Body() dto: CohortTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.archive(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('cohorts/:id/actions/sync-curriculum')
  @RequirePermissions('cohort.curriculum.sync')
  syncCurriculum(
    @Param('id') id: string,
    @Body() dto: CohortTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.syncCurriculum(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Get('cohorts/:id/mentors')
  @RequirePermissions('cohort.read')
  listMentors(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.listMentors(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Post('cohorts/:id/mentors')
  @RequirePermissions('cohort.mentor.manage')
  assignMentor(
    @Param('id') id: string,
    @Body() dto: AssignCohortMentorDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.assignMentor(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.membershipId,
      user.id,
    );
  }

  @Delete('cohorts/:id/mentors/:mentorMembershipId')
  @RequirePermissions('cohort.mentor.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassignMentor(
    @Param('id') id: string,
    @Param('mentorMembershipId') mentorMembershipId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.cohortsService.unassignMentor(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      mentorMembershipId,
      user.id,
    );
  }

  @Get('cohorts/:id/tracks')
  @RequirePermissions('cohort.read')
  listOfferedTracks(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.listOfferedTracks(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Put('cohorts/:id/tracks')
  @RequirePermissions('cohort.update')
  async setOfferedTracks(
    @Param('id') id: string,
    @Body() dto: SetCohortTracksDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.cohortsService.setOfferedTracks(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.learningTrackIds,
      user.id,
    );
    return this.cohortsService.listOfferedTracks(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Post('cohorts/:id/actions/close-track-switching')
  @RequirePermissions('cohort.update')
  closeTrackSwitching(
    @Param('id') id: string,
    @Body() dto: CohortTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.closeTrackSwitching(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('cohorts/:id/actions/reopen-track-switching')
  @RequirePermissions('cohort.update')
  reopenTrackSwitching(
    @Param('id') id: string,
    @Body() dto: CohortTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.cohortsService.reopenTrackSwitching(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
