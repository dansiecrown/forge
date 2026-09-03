import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { NotificationsService } from '../services/notifications.service';

/** Self-scoped only — no `@RequirePermissions`, same "give me my own data"
 * shape as `GET/DELETE /auth/sessions`. This is `PlatformModule`'s first
 * controller. */
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me/notifications')
  list(
    @CurrentUser() user: { id: string },
    @Query('unreadOnly') unreadOnly?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.listForRecipient(user.id, {
      unreadOnly: unreadOnly === 'true',
      cursor,
      limit,
    });
  }

  @Post('me/notifications/:id/actions/mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.notificationsService.markRead(user.id, id);
  }
}
