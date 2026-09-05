import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { RecordHuddleAttendanceDto, UpsertHuddleSessionDto } from '../dtos/huddle-session.dto';
import { HuddleSessionsService } from '../services/huddle-sessions.service';

@Controller()
export class HuddleSessionsController {
  constructor(private readonly huddleSessionsService: HuddleSessionsService) {}

  @Get('mentors/cohorts/:cohortId/huddles/:weekNumber')
  @RequirePermissions('learning.huddle.manage')
  getSession(
    @Param('cohortId') cohortId: string,
    @Param('weekNumber', ParseIntPipe) weekNumber: number,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.huddleSessionsService.getSession(
      { organizationId: requireOrganizationId(organizationId) },
      cohortId,
      weekNumber,
      user.id,
    );
  }

  @Put('mentors/cohorts/:cohortId/huddles/:weekNumber')
  @RequirePermissions('learning.huddle.manage')
  upsertSession(
    @Param('cohortId') cohortId: string,
    @Param('weekNumber', ParseIntPipe) weekNumber: number,
    @Body() dto: UpsertHuddleSessionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.huddleSessionsService.upsertSession(
      { organizationId: requireOrganizationId(organizationId) },
      cohortId,
      weekNumber,
      user.id,
      dto,
    );
  }

  @Put('mentors/huddles/:sessionId/attendance')
  @RequirePermissions('learning.huddle.manage')
  recordAttendance(
    @Param('sessionId') sessionId: string,
    @Body() dto: RecordHuddleAttendanceDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.huddleSessionsService.recordAttendance(
      { organizationId: requireOrganizationId(organizationId) },
      sessionId,
      user.id,
      dto.entries,
    );
  }

  /** Pre-fills the mentor's attendance roster — symmetric with the PUT
   * above. */
  @Get('mentors/huddles/:sessionId/attendance')
  @RequirePermissions('learning.huddle.manage')
  listAttendanceForSession(
    @Param('sessionId') sessionId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.huddleSessionsService.listAttendanceForSession(
      { organizationId: requireOrganizationId(organizationId) },
      sessionId,
      user.id,
    );
  }

  /** Dual-path — the student's own attendance view and the mentor's
   * student-workspace tab both call this; the service enforces the actual
   * per-resource check, matching how `getProgress` already works. */
  @Get('enrollments/:id/attendance')
  @RequirePermissions('enrollment.progress.read')
  listAttendance(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.huddleSessionsService.listAttendanceForEnrollment(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }
}
