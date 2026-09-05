import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { ChatMessagesController } from './controllers/chat-messages.controller';
import { FellowshipChatChannelsController } from './controllers/fellowship-chat-channels.controller';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatChannelsRepository } from './repositories/chat-channels.repository';
import { ChatMessagesRepository } from './repositories/chat-messages.repository';
import { ChatReadStateRepository } from './repositories/chat-read-state.repository';
import { ChatAccessService } from './services/chat-access.service';
import { ChatChannelsService } from './services/chat-channels.service';
import { ChatMessagesService } from './services/chat-messages.service';
import { RedisEventsService } from './services/redis-events.service';

/** `ChatChannelsService` is exported so `CatalogModule` can import
 * `ChatModule` and inject it into `FellowshipsService`, which auto-creates
 * #general on fellowship creation — see
 * docs/adr/0014-fellowship-chat.md Decision 4. The dependency runs one way
 * only (Catalog -> Chat); this module never imports Catalog, so there's no
 * cycle. */
@Module({
  imports: [OrganizationsModule, PlatformModule, IdentityModule],
  controllers: [FellowshipChatChannelsController, ChatMessagesController],
  providers: [
    ChatChannelsRepository,
    ChatMessagesRepository,
    ChatReadStateRepository,
    ChatAccessService,
    ChatChannelsService,
    ChatMessagesService,
    RedisEventsService,
    ChatGateway,
  ],
  exports: [ChatChannelsService],
})
export class ChatModule {}
