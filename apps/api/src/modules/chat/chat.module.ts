import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { ChatMessagesController } from './controllers/chat-messages.controller';
import { DirectMessagesController } from './controllers/direct-messages.controller';
import { FellowshipChatChannelsController } from './controllers/fellowship-chat-channels.controller';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatChannelsRepository } from './repositories/chat-channels.repository';
import { ChatMessagesRepository } from './repositories/chat-messages.repository';
import { ChatReadStateRepository } from './repositories/chat-read-state.repository';
import { DirectMessagesRepository } from './repositories/direct-messages.repository';
import { ChatAccessService } from './services/chat-access.service';
import { ChatChannelsService } from './services/chat-channels.service';
import { ChatMembershipSyncService } from './services/chat-membership-sync.service';
import { ChatMessagesService } from './services/chat-messages.service';
import { DirectMessagesService } from './services/direct-messages.service';
import { RedisEventsService } from './services/redis-events.service';

/** `ChatChannelsService` is exported so `CatalogModule` can import
 * `ChatModule` and inject it into `FellowshipsService`, which auto-creates
 * #general on fellowship creation — see
 * docs/adr/0014-fellowship-chat.md Decision 4. `ChatMembershipSyncService`
 * is exported the same way so `CohortsModule` can import `ChatModule` and
 * inject it into `EnrollmentsService`, to keep #general's real membership
 * rows in sync with Enrollment status — see that service's own doc comment
 * and this ADR's 2026-09-07 addendum. Both dependencies run one way only
 * (Catalog/Cohorts -> Chat); this module never imports either, so there's
 * no cycle. */
@Module({
  imports: [OrganizationsModule, PlatformModule, IdentityModule],
  controllers: [FellowshipChatChannelsController, ChatMessagesController, DirectMessagesController],
  providers: [
    ChatChannelsRepository,
    ChatMessagesRepository,
    ChatReadStateRepository,
    DirectMessagesRepository,
    ChatAccessService,
    ChatChannelsService,
    ChatMembershipSyncService,
    ChatMessagesService,
    DirectMessagesService,
    RedisEventsService,
    ChatGateway,
  ],
  exports: [ChatChannelsService, ChatMembershipSyncService],
})
export class ChatModule {}
