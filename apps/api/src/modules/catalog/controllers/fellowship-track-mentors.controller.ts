import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { AssignFellowshipTrackMentorDto } from '../dtos/fellowship-track-mentor.dto';
import { FellowshipTrackMentorsService } from '../services/fellowship-track-mentors.service';

/** Fellowship-wide, per-track mentor roster — see
 * docs/adr/0016-cohort-scoped-tracks.md. Reuses `cohort.mentor.manage`
 * (already held by ORG_ADMIN/ACADEMY_ADMIN) rather than a new permission
 * key, since it's the same "who manages mentor assignments" capability. */
@Controller('learning-tracks/:trackId/mentors')
export class FellowshipTrackMentorsController {
  constructor(private readonly trackMentorsService: FellowshipTrackMentorsService) {}

  @Get()
  @RequirePermissions('curriculum.read')
  list(
    @Param('trackId') trackId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
  ) {
    return this.trackMentorsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      trackId,
    );
  }

  @Post()
  @RequirePermissions('cohort.mentor.manage')
  assign(
    @Param('trackId') trackId: string,
    @Body() dto: AssignFellowshipTrackMentorDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.trackMentorsService.assign(
      { organizationId: requireOrganizationId(organizationId) },
      trackId,
      dto.membershipId,
      user.id,
    );
  }

  @Delete(':membershipId')
  @RequirePermissions('cohort.mentor.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassign(
    @Param('trackId') trackId: string,
    @Param('membershipId') membershipId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.trackMentorsService.unassign(
      { organizationId: requireOrganizationId(organizationId) },
      trackId,
      membershipId,
      user.id,
    );
  }
}
