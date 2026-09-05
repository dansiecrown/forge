import { Controller, Get, HttpCode, HttpStatus, Param, Put, Delete, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { parseLimit } from '../../../shared/pagination/collection-result';
import { requireOrganizationId } from '../../../shared/http/request-helpers';
import { StudentCurriculumService } from '../services/student-curriculum.service';

/** Every route here is self-scoped to `:id` (an enrollment) and reads
 * exclusively from the caller's cohort's frozen `curriculumSnapshot` — never
 * live catalog tables (docs/adr/0006-curriculum-learning-engine.md). Reuses
 * `enrollment.progress.read` (already granted to every role including
 * STUDENT) for every GET here; ownership is enforced in the service
 * (`ProgressionService.buildContext`'s self-or-staff-`enrollment.read`
 * check), the permission just satisfies `PermissionsGuard`'s
 * organization-header resolution. */
@Controller('enrollments/:id')
export class StudentCurriculumController {
  constructor(private readonly studentCurriculumService: StudentCurriculumService) {}

  @Get('weekly-modules')
  @RequirePermissions('enrollment.progress.read')
  listWeeklyModules(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.studentCurriculumService.listWeeklyModules(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Get('weekly-modules/:moduleId')
  @RequirePermissions('enrollment.progress.read')
  getWeeklyModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.studentCurriculumService.getWeeklyModuleDetail(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      moduleId,
    );
  }

  @Get('lessons/:lessonId')
  @RequirePermissions('enrollment.progress.read')
  getLesson(
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.studentCurriculumService.getLessonDetail(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      lessonId,
    );
  }

  @Get('learning-resources')
  @RequirePermissions('enrollment.progress.read')
  listLearningResources(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('q') q?: string,
    @Query('resourceType') resourceType?: string,
    @Query('moduleId') moduleId?: string,
    @Query('bookmarked') bookmarked?: string,
  ) {
    return this.studentCurriculumService.listLearningResources(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      { q, resourceType, moduleId, bookmarked: bookmarked === 'true' },
    );
  }

  @Get('practical-tasks')
  @RequirePermissions('enrollment.progress.read')
  listPracticalTasks(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.studentCurriculumService.listPracticalTasks(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Get('practical-tasks/:taskId')
  @RequirePermissions('enrollment.progress.read')
  getPracticalTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.studentCurriculumService.getPracticalTaskDetail(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      taskId,
    );
  }

  @Get('activity')
  @RequirePermissions('enrollment.progress.read')
  getActivity(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ) {
    return this.studentCurriculumService.getActivity(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      parseLimit(limit),
    );
  }

  @Get('dashboard')
  @RequirePermissions('enrollment.progress.read')
  getDashboard(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.studentCurriculumService.getDashboard(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Get('bookmarks')
  @RequirePermissions('enrollment.progress.read')
  listBookmarks(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.studentCurriculumService.listBookmarks(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Put('bookmarks/:resourceId')
  @RequirePermissions('learning.bookmark.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async addBookmark(
    @Param('id') id: string,
    @Param('resourceId') resourceId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.studentCurriculumService.addBookmark(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      resourceId,
    );
  }

  @Delete('bookmarks/:resourceId')
  @RequirePermissions('learning.bookmark.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBookmark(
    @Param('id') id: string,
    @Param('resourceId') resourceId: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    await this.studentCurriculumService.removeBookmark(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
      resourceId,
    );
  }
}
