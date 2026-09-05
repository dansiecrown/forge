import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { MentorDashboardService } from '../services/mentor-dashboard.service';
import { MentorWorkspaceService } from '../services/mentor-workspace.service';

@Controller('mentors')
@RequirePermissions('mentor.workspace.read')
export class MentorWorkspaceController {
  constructor(
    private readonly mentorWorkspaceService: MentorWorkspaceService,
    private readonly mentorDashboardService: MentorDashboardService,
  ) {}

  @Get('me/cohorts')
  listMyCohorts(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorWorkspaceService.listMyCohorts(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
    );
  }

  @Get('me/dashboard')
  getDashboard(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorDashboardService.getDashboard(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
    );
  }

  @Get('me/review-queue')
  listReviewQueue(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorDashboardService.listReviewQueue(
      { organizationId: requireOrganizationId(organizationId) },
      user.id,
    );
  }

  @Get('cohorts/:cohortId/students')
  listStudents(
    @Param('cohortId') cohortId: string,
    @Query('q') q: string | undefined,
    @Query('status') status: string | undefined,
    @Query('sort') sort: 'name' | 'progress' | 'status' | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorWorkspaceService.listStudents(
      { organizationId: requireOrganizationId(organizationId) },
      cohortId,
      user.id,
      { q, status, sort },
    );
  }

  @Get('students/:enrollmentId/workspace')
  getStudentWorkspace(
    @Param('enrollmentId') enrollmentId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorWorkspaceService.getStudentWorkspace(
      { organizationId: requireOrganizationId(organizationId) },
      enrollmentId,
      user.id,
    );
  }
}
