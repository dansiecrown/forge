import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';

export type ChatEventName =
  | 'chat.message.created'
  | 'chat.message.updated'
  | 'chat.message.deleted'
  | 'chat.reaction.updated'
  | 'chat.channel.updated';

export interface ChatEvent {
  event: ChatEventName;
  fellowshipId: string;
  channelId: string;
  payload: unknown;
}

const REDIS_CHANNEL = 'fellowship-chat-events';

/** The "3. published as an event" / "4. delivered to authorized subscribers"
 * half of the message flow — `ChatGateway` is the only subscriber, listening
 * via `onEvent()` and re-broadcasting to the right socket.io room. A single
 * fixed Redis channel carries every event (not one Redis channel per
 * fellowship/channel) — simpler connection management, and the fan-out to
 * the *correct* room already happens socket.io-side once the gateway reads
 * `fellowshipId`/`channelId` off the decoded event.
 *
 * `publish()` never throws — a Redis outage degrades real-time delivery,
 * never write availability. The message itself is already committed to
 * PostgreSQL by the time this is called (see `ChatMessagesService.create()`),
 * so a lost publish only means other tabs/devices don't see it instantly;
 * they still see it on their next fetch/reconnect. */
@Injectable()
export class RedisEventsService implements OnModuleInit {
  private readonly logger = new Logger(RedisEventsService.name);
  private handler: ((event: ChatEvent) => void) | null = null;

  constructor(private readonly redis: RedisService) {}

  onModuleInit(): void {
    // ioredis's `subscribe()` is dual-mode (callback *and* a Promise that
    // rejects independently of it) — handling only the callback still left
    // the Promise unhandled, which crashed the whole process the moment
    // Redis was actually unreachable (a real, live-caught bug: this
    // environment runs Postgres natively without the docker-compose Redis
    // container, so Redis being down is the common case here, not the
    // exception "handle Redis failure gracefully" was written for). This
    // `.catch()` is what actually keeps a Redis outage from taking the API
    // down with it.
    this.redis.subClient.subscribe(REDIS_CHANNEL).catch((error: Error) => {
      this.logger.warn(`Failed to subscribe to ${REDIS_CHANNEL}: ${error.message}`);
    });
    this.redis.subClient.on('message', (channel, message) => {
      if (channel !== REDIS_CHANNEL || !this.handler) return;
      try {
        this.handler(JSON.parse(message) as ChatEvent);
      } catch (error) {
        this.logger.warn(`Failed to parse chat event: ${(error as Error).message}`);
      }
    });
  }

  /** `ChatGateway` registers exactly one handler here at startup. */
  onEvent(handler: (event: ChatEvent) => void): void {
    this.handler = handler;
  }

  async publish(event: ChatEvent): Promise<void> {
    try {
      await this.redis.pubClient.publish(REDIS_CHANNEL, JSON.stringify(event));
    } catch (error) {
      this.logger.warn(`Failed to publish chat event: ${(error as Error).message}`);
    }
  }
}
