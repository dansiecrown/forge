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

  /** The explicit, manual "set it back to unread" exception — see
   * NotificationsService.markUnread's doc comment. */
  @Post('me/notifications/:id/actions/mark-unread')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markUnread(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.notificationsService.markUnread(user.id, id);
  }

  @Post('me/notifications/actions/mark-all-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser() user: { id: string }) {
    await this.notificationsService.markAllRead(user.id);
  }
}
