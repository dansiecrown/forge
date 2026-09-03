import { Controller, Get, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { AdminReportsService } from '../services/admin-reports.service';

@Controller('admin/reports')
@RequirePermissions('reports.read')
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('enrollment-trends')
  enrollmentTrends(
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('weeks') weeks?: string,
  ) {
    return this.adminReportsService.getEnrollmentTrends(
      { organizationId: requireOrganizationId(organizationId) },
      weeks ? Number(weeks) : undefined,
    );
  }

  @Get('completion-rates')
  completionRates(@Query('fellowshipId') fellowshipId: string) {
    return this.adminReportsService.getCompletionRates(fellowshipId);
  }

  @Get('student-activity')
  studentActivity(
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('cohortId') cohortId: string,
  ) {
    return this.adminReportsService.getStudentActivity(
      { organizationId: requireOrganizationId(organizationId) },
      cohortId,
      user.id,
    );
  }

  @Get('mentor-activity')
  mentorActivity(@ActiveOrganizationId() organizationId: string | undefined) {
    return this.adminReportsService.getMentorActivity({
      organizationId: requireOrganizationId(organizationId),
    });
  }

  @Get('submission-stats')
  submissionStats(
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('cohortId') cohortId?: string,
  ) {
    return this.adminReportsService.getSubmissionStats(
      { organizationId: requireOrganizationId(organizationId) },
      cohortId,
    );
  }

  @Get('attendance-stats')
  attendanceStats(@Query('cohortId') cohortId: string) {
    return this.adminReportsService.getAttendanceStats(cohortId);
  }

  @Get('organization-stats')
  organizationStats(@ActiveOrganizationId() organizationId: string | undefined) {
    return this.adminReportsService.getOrganizationStats({
      organizationId: requireOrganizationId(organizationId),
    });
  }

  @Get('academy-stats')
  academyStats(@Query('academyId') academyId: string) {
    return this.adminReportsService.getAcademyStats(academyId);
  }

  @Get('fellowship-stats')
  fellowshipStats(@Query('fellowshipId') fellowshipId: string) {
    return this.adminReportsService.getFellowshipStats(fellowshipId);
  }
}
