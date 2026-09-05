import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import { CreateMentorNoteDto, UpdateMentorNoteDto } from '../dtos/mentor-note.dto';
import { MentorNotesService } from '../services/mentor-notes.service';

/** Never mounted under any student-facing route — mentor notes are staff-
 * only content, matching `docs/adr/0008-mentor-experience.md` Decision 6. */
@Controller()
export class MentorNotesController {
  constructor(private readonly mentorNotesService: MentorNotesService) {}

  @Get('enrollments/:id/mentor-notes')
  @RequirePermissions('learning.note.manage')
  list(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorNotesService.list(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Post('enrollments/:id/mentor-notes')
  @RequirePermissions('learning.note.manage')
  create(
    @Param('id') id: string,
    @Body() dto: CreateMentorNoteDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorNotesService.create(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.body,
      user.id,
    );
  }

  @Patch('mentor-notes/:noteId')
  @RequirePermissions('learning.note.manage')
  update(
    @Param('noteId') noteId: string,
    @Body() dto: UpdateMentorNoteDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorNotesService.update(
      { organizationId: requireOrganizationId(organizationId) },
      noteId,
      dto.body,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Delete('mentor-notes/:noteId')
  @RequirePermissions('learning.note.manage')
  delete(
    @Param('noteId') noteId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.mentorNotesService.delete(
      { organizationId: requireOrganizationId(organizationId) },
      noteId,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }
}
